#!/usr/bin/env python3
"""Tests of scripts/ci/pins/check.py in throwaway repositories.

Run from the repository root, with PyYAML (hash-pinned in scripts/ci/plan/requirements.txt):

	python3 -I -m unittest discover -s scripts/ci/pins -p 'test_*.py' -v

What the files say is run as the command runs. What the repositories and the registry
say is run in-process, with `ls_remote` and `registry_digest` replaced by stand-ins,
so no test uses the network.
"""

import contextlib
import importlib.util
import io
import os
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
CHECK = os.path.join(HERE, "check.py")
spec = importlib.util.spec_from_file_location("pins_check", CHECK)
check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check)

SHA = "a" * 40
SHA2 = "c" * 40
DIG = "b" * 64
DIG2 = "d" * 64
OK = f"      - uses: actions/checkout@{SHA} # v7.0.1"
DEBIAN = "docker.io/library/debian"


def make_repo(tmp, files):
    repo = os.path.join(tmp, "r")
    os.makedirs(repo)
    subprocess.run(["git", "-C", repo, "init", "-q", "-b", "main"], check=True)
    for path, text in files.items():
        full = os.path.join(repo, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as handle:
            handle.write(text)
    subprocess.run(["git", "-C", repo, "add", "-A"], check=True)
    return repo


def wf(*steps):
    return "jobs:\n  a:\n    steps:\n" + "\n".join(steps) + "\n"


def run(files, *args):
    """The exit status and the output of the command, in a repository made of `files`."""
    with tempfile.TemporaryDirectory() as tmp:
        repo = make_repo(tmp, files)
        done = subprocess.run([sys.executable, "-I", CHECK, *args], cwd=repo, capture_output=True, text=True)
        return done.returncode, done.stdout + done.stderr


def run_remote(files, answers=None, digests=None, fail_git=False, fail_registry=False):
    """The same, in-process with the network replaced; returns status, output and the questions asked."""
    asked = []

    def ls_remote(repo, release):
        asked.append(("git", repo, release))
        if fail_git:
            raise RuntimeError("fatal: unable to access")
        return (answers or {}).get((repo, release), "")

    def registry_digest(repository, tag):
        asked.append(("registry", repository, tag))
        if fail_registry:
            raise RuntimeError("no route")
        return (digests or {}).get((repository, tag), "")

    out = io.StringIO()
    with tempfile.TemporaryDirectory() as tmp:
        repo = make_repo(tmp, files)
        old = os.getcwd()
        os.chdir(repo)
        try:
            with mock(check, ls_remote=ls_remote, registry_digest=registry_digest), contextlib.redirect_stdout(out):
                status = check.main(["--remote"])
        finally:
            os.chdir(old)
    return status, out.getvalue(), asked


@contextlib.contextmanager
def mock(module, **replacements):
    saved = {name: getattr(module, name) for name in replacements}
    for name, value in replacements.items():
        setattr(module, name, value)
    try:
        yield
    finally:
        for name, value in saved.items():
            setattr(module, name, value)


def case(files_or_step, path=".github/workflows/x.yml"):
    """A repository with a valid workflow and the step under test in another file."""
    files = {".github/workflows/ok.yml": wf(OK)}
    files[path] = files_or_step if "jobs:" in files_or_step else wf(files_or_step)
    return files


class TheFilesSay(unittest.TestCase):
    def passes(self, step, **kw):
        status, out = run(case(step, **kw))
        self.assertEqual(status, 0, out)

    def fails(self, step, **kw):
        status, out = run(case(step, **kw))
        self.assertNotEqual(status, 0, f"passed: {step!r}")
        return out

    def test_what_passes(self):
        self.passes(OK)
        self.passes(f"      - uses: github/codeql-action/init@{SHA2} # v4.39.4")
        self.passes("    uses: ./.github/workflows/ci-e2e.yml")
        self.passes(f"      - uses: docker://{DEBIAN}:trixie@sha256:{DIG}")
        self.passes(f'      - "uses": actions/checkout@{SHA} # v7.0.1')
        self.passes("      # - uses: actions/checkout@v7")

    def test_a_reference_that_is_not_a_commit(self):
        for ref in ("actions/checkout@v7", "actions/checkout@v7.0.1", "actions/checkout@main", "actions/checkout@3d3c42e", f"actions/checkout@{SHA[1:]}", f"actions/checkout@{SHA}a", "actions/checkout"):
            self.fails(f"      - uses: {ref} # v7.0.1")

    def test_the_version_comment(self):
        for tail in ("", " #", " # the latest", " # 7.0.1", " # v7.0.1.2", " # latest v7.0.1"):
            self.fails(f"      - uses: actions/upload-artifact@{SHA}{tail}")

    def test_who_may_be_run(self):
        self.fails(f"      - uses: someone/tool@{SHA} # v1.0.0")
        self.fails(f"    uses: Glyndor/.github/.github/workflows/dco.yml@{SHA} # v1.21.0")
        self.fails(f"      - uses: actions-evil/checkout@{SHA} # v7.0.1")

    def test_images_in_a_uses(self):
        self.fails("      - uses: docker://alpine:3")
        self.fails(f"      - uses: docker://{DEBIAN}@sha256:abc")
        self.fails(f"      - uses: docker://alpine:3@sha256:{DIG}")
        self.fails(f"      - uses: docker://{DEBIAN}@sha256:{DIG}")  # no tag

    def test_images_anywhere_in_a_workflow(self):
        env = lambda image: f"      - run: echo 1\n        env:\n          IMAGE: {image}"  # noqa: E731
        self.passes(env(f"{DEBIAN}:trixie@sha256:{DIG}"))
        self.passes(env(f"docker.io/library/registry:3@sha256:{DIG}"))
        self.fails(env(f"docker.io/library/ubuntu:24.04@sha256:{DIG}"))
        self.fails(env(f"evil.example/library/debian:trixie@sha256:{DIG}"))
        self.fails(env(f"{DEBIAN}@sha256:{DIG}"))
        self.fails(f"      - run: podman run alpine:3@sha256:{DIG} true")

    def test_a_key_written_in_another_way_is_still_the_key(self):
        """The loader and GitHub read these as `uses`; the check reads what they read."""
        for key in ('"uses"', "'uses'", "uses ", '"uses" ', "? uses\n        "):
            step = f"      - {key}: actions/checkout@v7" if not key.startswith("?") else "      - ? uses\n        : actions/checkout@v7"
            out = self.fails(step)
            self.assertIn("actions/checkout@v7", out, key)
        self.fails("      - { uses: actions/checkout@v7 }")
        self.fails(f"      - {{ uses: actions/checkout@{SHA}, name: x }} # v7.0.1")  # a pin in a flow mapping cannot carry its version
        self.fails("      - { name: x, with: { uses: actions/checkout@v7 } }")
        self.fails("      - name: x\n        with: { a: [ { uses: actions/checkout@v7 } ] }")
        self.fails("      - { 'uses': actions/checkout@v7 }")
        self.fails("      - !!str uses: actions/checkout@v7")

    def test_every_uses_is_judged_not_only_the_ones_that_look_alike(self):
        steps = [f"      - {k}: actions/checkout@{SHA} # v7.0.1" for k in ("uses", '"uses"', "'uses'", "uses ")]
        status, out = run(case("\n".join(steps)))
        self.assertEqual(status, 0, out)
        self.assertIn("5 references", out)  # these four and the one of ok.yml

    def test_a_value_that_cannot_be_judged(self):
        self.fails("      - uses: |\n          actions/checkout@v7")
        self.fails("      - uses: >-\n          actions/checkout@v7")
        self.fails('      - uses: "actions/checkout@v7\n          "')
        self.fails("      - uses:\n          - actions/checkout@v7")
        self.fails("      - uses: 123")

    def test_a_file_that_is_not_yaml_or_has_a_key_twice(self):
        twice = f"jobs:\n  a:\n    steps:\n      - uses: actions/checkout@{SHA} # v7.0.1\n        uses: actions/checkout@{SHA} # v7.0.1\n"
        self.assertNotEqual(run({".github/workflows/ok.yml": wf(OK), ".github/workflows/x.yml": twice})[0], 0, "a key written twice, both valid")
        self.fails("jobs: [unclosed\n")

    def test_where_the_files_are(self):
        for path in (".github/workflows/x.yaml", ".github/workflows/sub/x.yml", "tools/y/action.yml", ".github/actions/z/action.yaml"):
            self.fails("      - uses: actions/checkout@v7", path=path)

    def test_a_tree_with_no_workflow_reads_nothing_and_says_so(self):
        status, out = run({"README": "hi\n"})
        self.assertNotEqual(status, 0)
        self.assertIn("read nothing", out)

    def test_one_commit_and_one_release_for_each_action_in_the_tree(self):
        def two(first, second):
            return run({".github/workflows/x.yml": wf(first), ".github/workflows/y.yml": wf(second)})[0]

        self.assertEqual(two(OK, OK), 0)
        self.assertNotEqual(two(OK, f"      - uses: actions/checkout@{SHA2} # v7.0.1"), 0)
        self.assertNotEqual(two(OK, f"      - uses: actions/checkout@{SHA} # v7.0.2"), 0)
        self.assertEqual(two(OK, f"      - uses: actions/upload-artifact@{SHA2} # v7.0.2"), 0)
        init, analyze = (f"      - uses: github/codeql-action/{p}@{c} # v4.39.4" for p, c in (("init", SHA), ("analyze", SHA)))
        self.assertEqual(two(init, analyze), 0)
        self.assertNotEqual(two(init, f"      - uses: github/codeql-action/analyze@{SHA2} # v4.39.4"), 0)

    def test_one_tag_and_one_digest_for_each_image_in_the_tree(self):
        def two(first, second):
            image = lambda ref: f"      - run: echo 1\n        env:\n          IMAGE: {ref}"  # noqa: E731
            return run({".github/workflows/x.yml": wf(image(first)), ".github/workflows/y.yml": wf(image(second))})[0]

        same = f"{DEBIAN}:trixie@sha256:{DIG}"
        self.assertEqual(two(same, same), 0)
        self.assertNotEqual(two(same, f"{DEBIAN}:trixie@sha256:{DIG2}"), 0)
        self.assertNotEqual(two(same, f"{DEBIAN}:forky@sha256:{DIG}"), 0)
        self.assertEqual(two(same, f"docker.io/library/registry:3@sha256:{DIG2}"), 0)

    def test_an_unknown_option_is_refused(self):
        self.assertEqual(run(case(OK), "--other")[0], 2)

    def test_this_repository_passes_and_the_count_is_the_one_of_the_yaml(self):
        """The number of `uses` the check judged is the number the loader finds, file by file."""
        status = subprocess.run([sys.executable, "-I", CHECK], cwd=ROOT, capture_output=True, text=True)
        self.assertEqual(status.returncode, 0, status.stdout)
        found = 0
        for path in check_files():
            with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
                found += count_uses(yaml.load(handle, Loader=check.StrictLoader))
        self.assertIn(f"{found} references", status.stdout)


def check_files():
    old = os.getcwd()
    os.chdir(ROOT)
    try:
        return check.tracked_files()
    finally:
        os.chdir(old)


def count_uses(node):
    if isinstance(node, dict):
        return sum((1 if key == "uses" else 0) + count_uses(value) for key, value in node.items())
    if isinstance(node, list):
        return sum(count_uses(item) for item in node)
    return 0


class TheRepositoriesSay(unittest.TestCase):
    FILES = {".github/workflows/x.yml": wf(OK)}
    IMAGE = {".github/workflows/x.yml": wf(OK, f"      - run: echo\n        env:\n          I: {DEBIAN}:trixie@sha256:{DIG}")}

    def test_the_tag_points_to_the_commit(self):
        status, out, asked = run_remote(self.FILES, {("actions/checkout", "v7.0.1"): f"{SHA}\trefs/tags/v7.0.1\n"})
        self.assertEqual(status, 0, out)
        self.assertEqual(asked, [("git", "actions/checkout", "v7.0.1")])

    def test_the_tag_points_to_another_commit(self):
        self.assertNotEqual(run_remote(self.FILES, {("actions/checkout", "v7.0.1"): f"{SHA2}\trefs/tags/v7.0.1\n"})[0], 0)

    def test_an_annotated_tag_counts_by_its_peeled_commit(self):
        both = f"{SHA2}\trefs/tags/v7.0.1\n{SHA}\trefs/tags/v7.0.1^{{}}\n"
        self.assertEqual(run_remote(self.FILES, {("actions/checkout", "v7.0.1"): both})[0], 0)
        wrong = f"{SHA}\trefs/tags/v7.0.1\n{SHA2}\trefs/tags/v7.0.1^{{}}\n"
        self.assertNotEqual(run_remote(self.FILES, {("actions/checkout", "v7.0.1"): wrong})[0], 0)

    def test_a_tag_that_is_not_there_or_is_another_one_with_the_same_start(self):
        self.assertNotEqual(run_remote(self.FILES, {})[0], 0)
        self.assertNotEqual(run_remote(self.FILES, {("actions/checkout", "v7.0.1"): f"{SHA}\trefs/tags/v7.0.10\n"})[0], 0)

    def test_a_repository_that_cannot_be_asked_is_not_approved(self):
        status, out, _ = run_remote(self.FILES, fail_git=True)
        self.assertNotEqual(status, 0)
        self.assertIn("could not ask", out)

    def test_each_action_is_asked_once_with_its_own_release(self):
        files = {".github/workflows/x.yml": wf(OK, f"      - uses: actions/upload-artifact@{SHA2} # v7.0.2", OK)}
        answers = {("actions/checkout", "v7.0.1"): f"{SHA}\trefs/tags/v7.0.1\n", ("actions/upload-artifact", "v7.0.2"): f"{SHA2}\trefs/tags/v7.0.2\n"}
        status, out, asked = run_remote(files, answers)
        self.assertEqual(status, 0, out)
        self.assertEqual(sorted(asked), [("git", "actions/checkout", "v7.0.1"), ("git", "actions/upload-artifact", "v7.0.2")])

    def test_the_digest_is_the_one_the_registry_gives_for_the_tag(self):
        answers = {("actions/checkout", "v7.0.1"): f"{SHA}\trefs/tags/v7.0.1\n"}
        good = {(DEBIAN, "trixie"): f"sha256:{DIG}"}
        status, out, asked = run_remote(self.IMAGE, answers, good)
        self.assertEqual(status, 0, out)
        self.assertIn(("registry", DEBIAN, "trixie"), asked)
        self.assertNotEqual(run_remote(self.IMAGE, answers, {(DEBIAN, "trixie"): f"sha256:{DIG2}"})[0], 0)
        self.assertNotEqual(run_remote(self.IMAGE, answers, {})[0], 0)

    def test_a_registry_that_cannot_be_asked_is_not_approved(self):
        answers = {("actions/checkout", "v7.0.1"): f"{SHA}\trefs/tags/v7.0.1\n"}
        status, out, _ = run_remote(self.IMAGE, answers, fail_registry=True)
        self.assertNotEqual(status, 0)
        self.assertIn("could not ask the registry", out)

    def test_nothing_is_asked_without_the_option(self):
        asked = []
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(tmp, self.IMAGE)
            old = os.getcwd()
            os.chdir(repo)
            try:
                with mock(check, ls_remote=lambda *a: asked.append(a), registry_digest=lambda *a: asked.append(a)), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(check.main([]), 0)
            finally:
                os.chdir(old)
        self.assertEqual(asked, [])


if __name__ == "__main__":
    unittest.main()
