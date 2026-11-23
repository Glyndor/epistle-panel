#!/usr/bin/env python3
"""Every `uses:` of a workflow or an action of this repository is fixed to a commit
that is the release it says, every image is fixed to the digest of its tag, and
nothing runs that is not from `actions/` or `github/`.

    check.py                           what the files say
    check.py --remote                  and ask the repositories and the registry (everything)
    check.py --remote --base REV       as a pull request: ask about the pins that change from REV
    check.py --remote --weekly [--report FILE]
                                       the Monday pass: nothing is held back for a moved image

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
its tag. Every question is tried three times. A repository or a registry that cannot
be asked, or a tag that is not there, fails: a check that cannot look does not
approve.

The tag of an action does not move, so every action is asked about. The tag of an
image does, and a pull request is not to blame when it does: with --base, an image
whose tag and digest are the ones the base has was verified when it came in and is
not asked about again, and a pin that changed has to carry the digest the registry
gives now. An action that is not asked about for want of a network, and has not
changed, is a notice and not a failure. With --weekly nothing blocks: an image the
registry now gives another digest for is written to --report as data, for the job
that opens or updates the issue, and a failure to ask about an image is a notice.

It reads every tracked workflow and action: `.github/**/*.yml` and `.yaml`, and
`action.yml` or `action.yaml` anywhere in the tree.
"""

import json
import os
import re
import subprocess
import sys
import time
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


def is_workflow(name):
    return bool((re.match(r"^\.github/.*\.ya?ml$", name) and name != ".github/dependabot.yml") or re.search(r"(^|/)action\.ya?ml$", name))


def tracked_files():
    out = subprocess.run(["git", "ls-files", "-z"], check=True, capture_output=True).stdout
    return [n for n in (p.decode("utf-8", "surrogateescape") for p in out.split(b"\0") if p) if is_workflow(n)]


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


def with_retries(question, *args, attempts=3, delay=5):
    """The answer of `question`, tried `attempts` times; the last failure is raised."""
    for number in range(attempts):
        try:
            return question(*args)
        except Exception:  # noqa: BLE001 - any failure to ask is tried again
            if number == attempts - 1:
                raise
            time.sleep(delay)


class Check:
    def __init__(self, remote=False, base=None, weekly=False):
        self.remote = remote
        self.base = base  # a Check of the base commit, or None
        self.weekly = weekly
        self.errors = []
        self.notices = []
        self.drift = []
        self.checked = 0
        self.pairs = {}  # action -> (commit, release, where)
        self.images = {}  # repository -> (tag, digest, where)
        self.seen_pairs = set()  # (action, commit, release), wherever it is written
        self.seen_images = set()  # (repository, tag, digest)

    def error(self, path, line, message):
        self.errors.append(f"::error file={path},line={line}::{message}")

    def notice(self, path, line, message):
        self.notices.append(f"::notice file={path},line={line}::{message}")

    def judge_file(self, path, text=None):
        if text is None:
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
        self.seen_images.add((repository, tag, digest))
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
        self.seen_pairs.add((action, commit, release))
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
            changed = self.base is None or (action, commit, release) not in self.base.seen_pairs
            try:
                answer = with_retries(ls_remote, action, release)
            except Exception as problem:  # noqa: BLE001 - any failure to ask is a failure, unless nothing changed
                message = f"could not ask https://github.com/{action} for the tag {release}: {problem}"
                if changed:
                    self.error(path, line, f"{message}, so {commit[:7]} is not approved")
                else:
                    self.notice(path, line, f"{message}; the pin is the one the base has, so nothing is held back")
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
            if self.base is not None and (repository, tag, digest) in self.base.seen_images:
                continue  # verified when it came in; the registry may have moved on since
            try:
                got = with_retries(registry_digest, repository, tag)
            except Exception as problem:  # noqa: BLE001
                message = f"could not ask the registry for {repository}:{tag}: {problem}"
                if self.weekly:
                    self.notice(path, line, message)
                else:
                    self.error(path, line, f"{message}, so {digest[:19]} is not approved")
                continue
            if got == digest:
                continue
            if self.weekly:
                self.drift.append({"repository": repository, "tag": tag, "pinned": digest, "current": got})
                self.notice(path, line, f"{repository}:{tag} is {got[:19]} at the registry now, and the workflows pin {digest[:19]}")
            else:
                self.error(path, line, f"{repository}:{tag} is {got[:19]} at the registry, and the workflows pin {digest[:19]}")


def base_check(rev):
    """The pins of the files at `rev`, or None when they cannot be read."""
    try:
        listing = subprocess.run(["git", "ls-tree", "-r", "-z", "--name-only", rev], check=True, capture_output=True).stdout
        paths = [p.decode("utf-8", "surrogateescape") for p in listing.split(b"\0") if p]
        base = Check()
        for path in paths:
            if is_workflow(path):
                text = subprocess.run(["git", "show", f"{rev}:{path}"], check=True, capture_output=True).stdout.decode("utf-8")
                base.judge_file(path, text)
        return base
    except (subprocess.CalledProcessError, UnicodeDecodeError):
        return None


def main(argv):
    args = list(argv)
    remote = "--remote" in args
    weekly = "--weekly" in args
    base_rev = None
    report = None
    if "--base" in args:
        index = args.index("--base")
        base_rev = args[index + 1] if index + 1 < len(args) else None
        del args[index : index + 2]
    if "--report" in args:
        index = args.index("--report")
        report = args[index + 1] if index + 1 < len(args) else None
        del args[index : index + 2]
    args = [a for a in args if a not in ("--remote", "--weekly")]
    bad = (
        args
        or ("--base" in argv and not base_rev)
        or ("--report" in argv and not report)
        or ((base_rev or weekly) and not remote)
        or (base_rev and weekly)
        or (report and not weekly)
    )
    if bad:
        print("usage: check.py [--remote [--base REV | --weekly [--report FILE]]]", file=sys.stderr)
        return 2
    os.chdir(subprocess.run(["git", "rev-parse", "--show-toplevel"], check=True, capture_output=True, text=True).stdout.strip())
    files = tracked_files()
    if not files:
        print("::error::no workflow or action file found; the check read nothing")
        return 1
    base = None
    if base_rev:
        base = base_check(base_rev)
        if base is None:
            print(f"::notice::the pins of {base_rev} cannot be read, so every pin is asked about")
    check = Check(remote=remote, base=base, weekly=weekly)
    for path in files:
        check.judge_file(path)
    if remote:
        check.ask()
    if report:
        with open(report, "w", encoding="utf-8") as handle:
            json.dump(check.drift, handle, indent=2)
    for message in check.notices + check.errors:
        print(message)
    if check.errors:
        return 1
    print(f"{check.checked} references in {len(files)} files are fixed to a commit or a digest.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
