#!/usr/bin/env python3
"""Every `uses:` of a workflow or an action of this repository is fixed to a commit
that is the release it says, every image is fixed to the digest of its tag, and
nothing runs that is not from `actions/` or `github/`.

    check.py            what the files say
    check.py --remote   and ask the repositories and the registry whether it is true

The files are read as YAML, with a loader that refuses a key written twice, and the
references are the value of every mapping key `uses` wherever it is, however the key
is spelled (`"uses":`, `'uses' :`, `? uses`): what GitHub runs is what this reads. A
`uses` whose value is not one plain or quoted scalar on one line cannot be judged
and fails.

A reference passes when it is
  - local (`./...`), or
  - `actions/<name>[/<path>]@<40 hex digits> # vX.Y.Z` or the same with `github/`,
    with the release of the commit in the comment, or
  - `docker://<repository>:<tag>@sha256:<64 hex digits>` of a repository in
    IMAGE_REPOS.
Across the whole tree an action has ONE pair of commit and release, and an image
repository has ONE pair of tag and digest, so the one a job with privileges uses
cannot move alone. Every image fixed by digest anywhere in a workflow, `uses:` or
not, has a tag and is of a repository in IMAGE_REPOS.

With --remote, each commit is asked of its repository (`git ls-remote <repo>
refs/tags/<release> refs/tags/<release>^{}`) and has to be the one the tag points to
(the peeled one for an annotated tag), and each digest is asked of the registry for
its tag. A repository or a registry that cannot be asked, or a tag that is not
there, fails: a check that cannot look does not approve.

It reads every tracked workflow and action: `.github/**/*.yml` and `.yaml`, and
`action.yml` or `action.yaml` anywhere in the tree.
"""

import json
import os
import re
import subprocess
import sys
import urllib.request

import yaml

OWNERS = ("actions", "github")
# The repositories of the images that may be fixed by digest.
IMAGE_REPOS = ("docker.io/library/debian", "docker.io/library/registry")

_IMAGE = re.compile(r"(?<![A-Za-z0-9._/:@-])((?:docker://)?[A-Za-z0-9][A-Za-z0-9._/:-]*)@sha256:([0-9a-f]{64})")
_ACTION = re.compile(r"^([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+)(/[A-Za-z0-9._/-]+)?@(.+)$")
_RELEASE = re.compile(r"^v[0-9]+(\.[0-9]+){0,2}$")


class StrictLoader(yaml.SafeLoader):
    """SafeLoader that refuses a key written twice in one mapping."""


def _mapping(loader, node, deep=False):
    seen = set()
    for key_node, _ in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in seen:
            raise yaml.constructor.ConstructorError(None, None, f"duplicate key {key!r}", key_node.start_mark)
        seen.add(key)
    return yaml.SafeLoader.construct_mapping(loader, node, deep)


StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)


def tracked_files():
    out = subprocess.run(["git", "ls-files", "-z"], check=True, capture_output=True).stdout
    names = [p.decode("utf-8", "surrogateescape") for p in out.split(b"\0") if p]
    return [
        n
        for n in names
        if (re.match(r"^\.github/.*\.ya?ml$", n) and n != ".github/dependabot.yml") or re.search(r"(^|/)action\.ya?ml$", n)
    ]


def walk(node):
    yield node
    if isinstance(node, yaml.MappingNode):
        for key, value in node.value:
            yield from walk(key)
            yield from walk(value)
    elif isinstance(node, yaml.SequenceNode):
        for item in node.value:
            yield from walk(item)


def ls_remote(repo, release):
    """The answer of `git ls-remote` for the tag and the peeled tag, or an exception."""
    done = subprocess.run(
        ["git", "ls-remote", f"https://github.com/{repo}", f"refs/tags/{release}", f"refs/tags/{release}^{{}}"],
        capture_output=True,
        text=True,
        env=dict(os.environ, GIT_TERMINAL_PROMPT="0"),
        timeout=120,
    )
    if done.returncode != 0:
        raise RuntimeError(done.stderr.strip() or f"git ls-remote exited {done.returncode}")
    return done.stdout


def registry_digest(repository, tag):
    """The digest the registry gives for a tag of a Docker Hub image, or an exception."""
    name = repository.removeprefix("docker.io/")
    auth = f"https://auth.docker.io/token?service=registry.docker.io&scope=repository:{name}:pull"
    with urllib.request.urlopen(auth, timeout=60) as response:
        token = json.load(response)["token"]
    request = urllib.request.Request(
        f"https://registry-1.docker.io/v2/{name}/manifests/{tag}",
        method="HEAD",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, "
            "application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json",
        },
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        digest = response.headers.get("Docker-Content-Digest")
    if not digest:
        raise RuntimeError("the registry gave no digest")
    return digest


def split_image(ref):
    """(repository, tag or None, digest) of `repo[:tag]@sha256:digest`, `docker://` allowed."""
    match = _IMAGE.fullmatch(ref)
    if not match:
        return None
    name = match.group(1).removeprefix("docker://")
    last = name.rsplit("/", 1)[-1]
    if ":" in last:
        name, tag = name.rsplit(":", 1)
    else:
        tag = None
    return name, tag, "sha256:" + match.group(2)


class Check:
    def __init__(self, remote):
        self.remote = remote
        self.errors = []
        self.checked = 0
        self.pairs = {}  # action -> (commit, release, where)
        self.images = {}  # repository -> (tag, digest, where)

    def error(self, path, line, message):
        self.errors.append(f"::error file={path},line={line}::{message}")

    def judge_file(self, path):
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
        lines = text.split("\n")
        try:
            yaml.load(text, Loader=StrictLoader)
            root = yaml.compose(text, Loader=StrictLoader)
        except yaml.YAMLError as problem:
            self.error(path, 1, f"cannot be read as YAML ({problem}), so it is not judged")
            return
        if root is None:
            return
        for node in walk(root):
            if isinstance(node, yaml.MappingNode):
                for key, value in node.value:
                    if isinstance(key, yaml.ScalarNode) and key.value == "uses":
                        self.judge_uses(path, lines, key, value)
            if isinstance(node, yaml.ScalarNode) and isinstance(node.value, str) and "@sha256:" in node.value:
                self.judge_images(path, node)

    def judge_images(self, path, node):
        for match in _IMAGE.finditer(node.value):
            line = node.start_mark.line + 1 + node.value[: match.start()].count("\n")
            self.judge_image(path, line, match.group(0))

    def judge_image(self, path, line, ref):
        repository, tag, digest = split_image(ref)
        if repository not in IMAGE_REPOS:
            self.error(path, line, f"the image {repository} is not in the list of images this repository fixes by digest")
            return
        if tag is None:
            self.error(path, line, f"the image {repository}@{digest[:19]} has no tag; write {repository}:<tag>@sha256:<digest>")
            return
        if repository in self.images and self.images[repository][:2] != (tag, digest):
            old = self.images[repository]
            self.error(
                path,
                line,
                f"{repository} is fixed to {tag}@{digest[:19]} here and to {old[0]}@{old[1][:19]} in {old[2]}; an image has one tag and one digest in the whole tree",
            )
        self.images.setdefault(repository, (tag, digest, f"{path}:{line}"))

    def judge_uses(self, path, lines, key, value):
        line = key.start_mark.line + 1
        self.checked += 1
        if not isinstance(value, yaml.ScalarNode) or value.tag != "tag:yaml.org,2002:str" or value.style in ("|", ">"):
            self.error(path, line, "this uses: is not one plain or quoted string, so it is not judged")
            return
        if value.start_mark.line != value.end_mark.line:
            self.error(path, line, "this uses: spans lines, so it is not judged")
            return
        ref = value.value
        if ref.startswith("./"):
            return
        if ref.startswith("docker://"):
            if "@sha256:" not in ref:
                self.error(path, line, f"{ref} is an image without a sha256 digest")
            elif split_image(ref) is None:
                self.error(path, line, f"{ref} is not repository:tag@sha256:<digest>")
            else:
                self.judge_image(path, line, ref)
            return
        match = _ACTION.match(ref)
        if not match:
            self.error(path, line, f"{ref} has no @<commit>")
            return
        owner, name, _, commit = match.groups()
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            self.error(path, line, f"{ref} is fixed to '{commit}', not to a 40 digit commit")
            return
        if owner not in OWNERS:
            self.error(path, line, f"{owner}/{name} is not from actions/ or github/")
            return
        rest = lines[value.end_mark.line][value.end_mark.column :].strip()
        release = rest[1:].strip() if rest.startswith("#") else ""
        if not _RELEASE.match(release):
            self.error(path, line, f"{owner}/{name}@{commit[:7]} has no version comment like '# v1.2.3' (found '{release}')")
            return
        action = f"{owner}/{name}"
        if action in self.pairs and self.pairs[action][:2] != (commit, release):
            old = self.pairs[action]
            self.error(
                path,
                line,
                f"{action} is pinned to {commit[:7]} {release} here and to {old[0][:7]} {old[1]} in {old[2]}; an action has one commit and one release in the whole tree",
            )
        self.pairs.setdefault(action, (commit, release, f"{path}:{line}"))

    def ask(self):
        for action, (commit, release, where) in sorted(self.pairs.items()):
            path, _, line = where.rpartition(":")
            try:
                answer = ls_remote(action, release)
            except Exception as problem:  # noqa: BLE001 - any failure to ask is a failure
                self.error(path, line, f"could not ask https://github.com/{action} for the tag {release}, so {commit[:7]} is not approved: {problem}")
                continue
            peeled = plain = ""
            for row in answer.splitlines():
                fields = row.split()
                if len(fields) == 2 and fields[1] == f"refs/tags/{release}^{{}}":
                    peeled = fields[0]
                elif len(fields) == 2 and fields[1] == f"refs/tags/{release}":
                    plain = fields[0]
            expected = peeled or plain
            if not expected:
                self.error(path, line, f"{action} has no tag {release}, which the comment of {commit[:7]} names")
            elif expected != commit:
                self.error(path, line, f"{action} {release} is the commit {expected[:7]}, and the workflows pin {commit[:7]}")
        for repository, (tag, digest, where) in sorted(self.images.items()):
            path, _, line = where.rpartition(":")
            try:
                got = registry_digest(repository, tag)
            except Exception as problem:  # noqa: BLE001
                self.error(path, line, f"could not ask the registry for {repository}:{tag}, so {digest[:19]} is not approved: {problem}")
                continue
            if got != digest:
                self.error(path, line, f"{repository}:{tag} is {got[:19]} at the registry, and the workflows pin {digest[:19]}")


def main(argv):
    if argv not in ([], ["--remote"]):
        print("usage: check.py [--remote]", file=sys.stderr)
        return 2
    os.chdir(subprocess.run(["git", "rev-parse", "--show-toplevel"], check=True, capture_output=True, text=True).stdout.strip())
    files = tracked_files()
    if not files:
        print("::error::no workflow or action file found; the check read nothing")
        return 1
    check = Check(remote=bool(argv))
    for path in files:
        check.judge_file(path)
    if check.remote:
        check.ask()
    for message in check.errors:
        print(message)
    if check.errors:
        return 1
    print(f"{check.checked} references in {len(files)} files are fixed to a commit or a digest.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
