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
import json
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


def make_repo(tmp, files, base=None):
    """A repository of `files`; with `base`, that is the commit before, and `files` the change on it."""
    repo = os.path.join(tmp, "r")
    os.makedirs(repo)

    def git(*args):
        subprocess.run(["git", "-C", repo, "-c", "user.name=t", "-c", "user.email=t@example.invalid", "-c", "commit.gpgsign=false", *args], check=True, capture_output=True)

    def write(tree):
        for path, text in tree.items():
            full = os.path.join(repo, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as handle:
                handle.write(text)

    git("init", "-q", "-b", "main")
    if base is not None:
        write(base)
        git("add", "-A")
        git("commit", "-q", "-m", "base")
    write(files)
    git("add", "-A")
    if base is not None:
        git("commit", "-q", "--allow-empty", "-m", "change")
    return repo


def wf(*steps):
    return "jobs:\n  a:\n    steps:\n" + "\n".join(steps) + "\n"


def run(files, *args):
    """The exit status and the output of the command, in a repository made of `files`."""
    with tempfile.TemporaryDirectory() as tmp:
        repo = make_repo(tmp, files)
        done = subprocess.run([sys.executable, "-I", CHECK, *args], cwd=repo, capture_output=True, text=True)
        return done.returncode, done.stdout + done.stderr


def run_remote(files, answers=None, digests=None, fail_git=False, fail_registry=False, base=None, args=("--remote",), report=False):
    """The same, in-process with the network replaced; returns status, output and the questions asked.

    With `base`, the files are the change on top of that commit. `report` adds the
    report of the Monday pass to the answer."""
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
    drift = None
    with tempfile.TemporaryDirectory() as tmp:
        repo = make_repo(tmp, files, base)
        old = os.getcwd()
        os.chdir(repo)
        arguments = list(args) + (["--report", os.path.join(tmp, "drift.json")] if report else [])
        try:
            with mock(check, ls_remote=ls_remote, registry_digest=registry_digest), mock(check.time, sleep=lambda _: None), contextlib.redirect_stdout(out):
                status = check.main(arguments)
        finally:
            os.chdir(old)
        if report:
            with open(os.path.join(tmp, "drift.json"), encoding="utf-8") as handle:
                drift = json.load(handle)
    return (status, out.getvalue(), asked, drift) if report else (status, out.getvalue(), asked)


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


class ThePullRequestAndTheMonday(unittest.TestCase):
    """A pin that did not change is not asked about, so the registry moving blocks nobody."""

    MOVED = f"sha256:{DIG2}"
    TAG_OK = {("actions/checkout", "v7.0.1"): f"{SHA}\trefs/tags/v7.0.1\n"}

    def image(self, digest, extra=OK):
        return {".github/workflows/x.yml": wf(extra, f"      - run: echo\n        env:\n          I: {DEBIAN}:trixie@sha256:{digest}")}

    PR = ("--remote", "--base", "HEAD^1")

    def test_an_image_that_did_not_change_is_not_asked_about_and_the_pull_request_is_green(self):
        files = self.image(DIG)
        status, out, asked = run_remote({**files, ".github/workflows/y.yml": wf(OK)}, self.TAG_OK, {(DEBIAN, "trixie"): self.MOVED}, base=files, args=self.PR)
        self.assertEqual(status, 0, out)
        self.assertNotIn(("registry", DEBIAN, "trixie"), asked)

    def test_the_monday_pass_reports_the_moved_image_and_blocks_nothing(self):
        status, out, asked, drift = run_remote(self.image(DIG), self.TAG_OK, {(DEBIAN, "trixie"): self.MOVED}, args=("--remote", "--weekly"), report=True)
        self.assertEqual(status, 0, out)
        self.assertEqual(drift, [{"repository": DEBIAN, "tag": "trixie", "pinned": f"sha256:{DIG}", "current": self.MOVED}])
        self.assertIn("registry now", out)

    def test_the_monday_pass_reports_nothing_when_nothing_moved(self):
        status, out, _, drift = run_remote(self.image(DIG), self.TAG_OK, {(DEBIAN, "trixie"): f"sha256:{DIG}"}, args=("--remote", "--weekly"), report=True)
        self.assertEqual((status, drift), (0, []), out)

    def test_the_same_moved_image_fails_when_everything_is_asked_without_a_base(self):
        self.assertNotEqual(run_remote(self.image(DIG), self.TAG_OK, {(DEBIAN, "trixie"): self.MOVED})[0], 0)

    def test_an_image_changed_to_the_digest_the_registry_gives_passes(self):
        status, out, asked = run_remote(self.image(DIG2), self.TAG_OK, {(DEBIAN, "trixie"): self.MOVED}, base=self.image(DIG), args=self.PR)
        self.assertEqual(status, 0, out)
        self.assertIn(("registry", DEBIAN, "trixie"), asked)

    def test_an_image_changed_to_a_digest_that_is_not_the_one_of_the_tag_fails(self):
        status, out, _ = run_remote(self.image(DIG2), self.TAG_OK, {(DEBIAN, "trixie"): f"sha256:{'e' * 64}"}, base=self.image(DIG), args=self.PR)
        self.assertNotEqual(status, 0)
        self.assertIn("at the registry", out)

    def test_an_image_changed_of_tag_is_a_change(self):
        base = self.image(DIG)
        changed = {".github/workflows/x.yml": wf(OK, f"      - run: echo\n        env:\n          I: {DEBIAN}:forky@sha256:{DIG}")}
        status, out, asked = run_remote(changed, self.TAG_OK, {(DEBIAN, "forky"): f"sha256:{DIG2}"}, base=base, args=self.PR)
        self.assertNotEqual(status, 0)
        self.assertIn(("registry", DEBIAN, "forky"), asked)

    def test_an_action_changed_to_a_commit_that_is_not_the_one_of_the_tag_fails(self):
        base = {".github/workflows/x.yml": wf(OK)}
        other = {".github/workflows/x.yml": wf(f"      - uses: actions/checkout@{SHA2} # v7.0.1")}
        status, out, _ = run_remote(other, self.TAG_OK, base=base, args=self.PR)
        self.assertNotEqual(status, 0)
        self.assertIn("is the commit", out)

    def test_an_action_changed_to_the_commit_of_its_new_tag_passes(self):
        base = {".github/workflows/x.yml": wf(OK)}
        bumped = {".github/workflows/x.yml": wf(f"      - uses: actions/checkout@{SHA2} # v7.0.2")}
        status, out, _ = run_remote(bumped, {("actions/checkout", "v7.0.2"): f"{SHA2}\trefs/tags/v7.0.2\n"}, base=base, args=self.PR)
        self.assertEqual(status, 0, out)

    def test_an_action_that_did_not_change_is_still_asked_about_because_a_tag_does_not_move(self):
        files = {".github/workflows/x.yml": wf(OK)}
        wrong = {("actions/checkout", "v7.0.1"): f"{SHA2}\trefs/tags/v7.0.1\n"}
        self.assertNotEqual(run_remote(files, wrong, base=files, args=self.PR)[0], 0)
        status, _, asked = run_remote(files, self.TAG_OK, base=files, args=self.PR)
        self.assertEqual(status, 0)
        self.assertIn(("git", "actions/checkout", "v7.0.1"), asked)

    def test_a_question_that_cannot_be_asked_about_an_unchanged_action_is_a_notice(self):
        files = {".github/workflows/x.yml": wf(OK)}
        status, out, asked = run_remote(files, fail_git=True, base=files, args=self.PR)
        self.assertEqual(status, 0, out)
        self.assertIn("::notice", out)
        self.assertEqual(len(asked), 3, "it tried three times")

    def test_a_question_that_cannot_be_asked_about_a_changed_action_fails(self):
        base = {".github/workflows/x.yml": wf(OK)}
        bumped = {".github/workflows/x.yml": wf(f"      - uses: actions/checkout@{SHA2} # v7.0.2")}
        status, out, asked = run_remote(bumped, fail_git=True, base=base, args=self.PR)
        self.assertNotEqual(status, 0)
        self.assertEqual(len(asked), 3)

    def test_a_question_that_cannot_be_asked_about_a_changed_image_fails(self):
        status, out, _ = run_remote(self.image(DIG2), self.TAG_OK, fail_registry=True, base=self.image(DIG), args=self.PR)
        self.assertNotEqual(status, 0)

    def test_a_question_that_works_on_the_third_try_passes(self):
        calls = []
        real = check.ls_remote

        def flaky(repo, release):
            calls.append(1)
            if len(calls) < 3:
                raise RuntimeError("timeout")
            return f"{SHA}\trefs/tags/v7.0.1\n"

        files = {".github/workflows/x.yml": wf(OK)}
        with tempfile.TemporaryDirectory() as tmp:
            repo = make_repo(tmp, files, files)
            old = os.getcwd()
            os.chdir(repo)
            try:
                with mock(check, ls_remote=flaky), mock(check.time, sleep=lambda _: None), contextlib.redirect_stdout(io.StringIO()):
                    self.assertEqual(check.main(["--remote", "--base", "HEAD^1"]), 0)
            finally:
                os.chdir(old)
        self.assertEqual(len(calls), 3)
        self.assertIsNotNone(real)

    def test_the_monday_pass_does_not_forgive_an_action(self):
        files = {".github/workflows/x.yml": wf(OK)}
        self.assertNotEqual(run_remote(files, fail_git=True, args=("--remote", "--weekly"))[0], 0)
        self.assertNotEqual(run_remote(files, {("actions/checkout", "v7.0.1"): f"{SHA2}\trefs/tags/v7.0.1\n"}, args=("--remote", "--weekly"))[0], 0)

    def test_the_monday_pass_does_not_fail_for_an_image_it_cannot_ask_about(self):
        status, out, _, drift = run_remote(self.image(DIG), self.TAG_OK, fail_registry=True, args=("--remote", "--weekly"), report=True)
        self.assertEqual((status, drift), (0, []), out)
        self.assertIn("::notice", out)

    def test_a_base_that_cannot_be_read_makes_every_pin_a_change(self):
        files = self.image(DIG)
        status, out, asked = run_remote(files, self.TAG_OK, {(DEBIAN, "trixie"): self.MOVED}, base=files, args=("--remote", "--base", "no-such-revision"))
        self.assertNotEqual(status, 0)
        self.assertIn("cannot be read", out)
        self.assertIn(("registry", DEBIAN, "trixie"), asked)

    def test_the_options_are_checked(self):
        for args in (["--base", "HEAD^1"], ["--weekly"], ["--remote", "--base"], ["--remote", "--base", "HEAD^1", "--weekly"], ["--report", "x"], ["--remote", "--report", "x"], ["--remote", "--weekly", "--report"]):
            with contextlib.redirect_stderr(io.StringIO()):
                self.assertEqual(check.main(args), 2, args)


if __name__ == "__main__":
    unittest.main()
