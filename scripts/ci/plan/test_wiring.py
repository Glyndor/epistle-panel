#!/usr/bin/env python3
"""Tests of how .github/workflows/ci.yml is wired to the map and the gate.

Run from the repository root:

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

The shape is fixed exactly, not checked for presence. A suite's job has its own
name, its own command and its own condition, written here a second time, so
crossing the `run:` or the `if:` of two suites, giving one a fixed `false`, or
adding a job fails a test. The steps that read a script of the base commit are run
in a throwaway repository with a script on each side, and must run the base's.
The only exception by name is none: the set of jobs is closed, and a job that is
not in it fails.
"""

import glob
import importlib.util
import os
import re
import subprocess
import tempfile
import tomllib
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
WORKFLOWS = os.path.join(ROOT, ".github", "workflows")

with open(os.path.join(HERE, "map.toml"), "rb") as handle:
    DATA = tomllib.load(handle)
SUITES = list(DATA["suites"])
ALWAYS = list(DATA["always"])

FIRST = ["line-limit", "actionlint", "bun-version", "ci-scripts", "lint"]
SECOND = ["unit", "randomized", "debian", "release-scripts"]
THIRD = ["e2e", "container"]

NAMES = {
    "plan": "plan",
    "line-limit": "line limit",
    "actionlint": "actionlint",
    "bun-version": "bun version",
    "ci-scripts": "ci scripts",
    "lint": "lint",
    "unit": "unit",
    "randomized": "randomized",
    "debian": "debian",
    "release-scripts": "release scripts",
    "e2e": "e2e",
    "container": "container",
    "gate": "ci gate",
}
# What each inline job runs, and nothing else runs it.
RUNS = {
    "plan": "plan.py",
    "line-limit": "scripts/ci/line-limit/check.sh",
    "actionlint": "actionlint_${ACTIONLINT_VERSION}",
    "bun-version": "scripts/consistency/check-bun-version.sh",
    "ci-scripts": "unittest discover -s scripts/ci/plan",
    "lint": "bun run lint",
    "unit": "scripts/test/coverage.sh",
    "randomized": "scripts/test/randomized.sh 1",
    "gate": "gate.py",
}
# What each calling job calls.
CALLS = {
    "debian": "ci-debian.yml",
    "release-scripts": "ci-release-scripts.yml",
    "e2e": "ci-e2e.yml",
    "container": "ci-container.yml",
}


def code(text):
    """The text without its comment lines."""
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


def jobs_of(text):
    """{job id: its block of text} for the top-level jobs of a workflow."""
    body = text.split("\njobs:\n", 1)[1]
    out = {}
    for block in re.split(r"\n(?=  [a-z0-9-]+:\n)", "\n" + body):
        m = re.match(r"\n?  ([a-z0-9-]+):\n", block + "\n")
        if m:
            out[m.group(1)] = block
    return out


def needs_of(block):
    """The jobs a job waits for, from `needs: [a, b]` or from a list."""
    m = re.search(r"\n    needs: \[([^\]]*)\]", block)
    if m:
        return {n.strip() for n in m.group(1).split(",") if n.strip()}
    m = re.search(r"\n    needs:\n((?:      - [^\n]+\n)+)", block + "\n")
    return {line.strip()[2:] for line in m.group(1).splitlines()} if m else set()


def condition_of(block):
    m = re.search(r"\n    if: \$\{\{ (.*) \}\}\n", block)
    return m.group(1) if m else None


def step_run(block, step_name):
    """The `run:` text of the step with this name, dedented."""
    m = re.search(rf"\n      - name: {re.escape(step_name)}\n(?:        [^\n]*\n)*?        run: \|\n((?:          [^\n]*\n|\n)+)", block + "\n")
    assert m, f"no step named {step_name!r}"
    return "\n".join(line[10:] for line in m.group(1).splitlines())


class Fixture:
    """A throwaway repository: a base commit and a change on top of it."""

    def __init__(self, tmp, base_files, change_files):
        self.dir = os.path.join(tmp, "repo")
        os.makedirs(self.dir)
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.invalid")
        self.git("config", "user.name", "t")
        self.git("config", "commit.gpgsign", "false")
        self.write(base_files or {"unrelated": "x"})
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")
        self.base = self.git("rev-parse", "HEAD")
        self.write(change_files)
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "change")

    def git(self, *args):
        done = subprocess.run(["git", "-C", self.dir, *args], check=True, capture_output=True, text=True)
        return done.stdout.strip()

    def write(self, files):
        for path, text in files.items():
            full = os.path.join(self.dir, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as handle:
                handle.write(text)

    def run(self, script, **env):
        merged = dict(os.environ, **env)
        return subprocess.run(["bash", "-c", script], cwd=self.dir, env=merged, capture_output=True, text=True)


class Wiring(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(WORKFLOWS, "ci.yml"), encoding="utf-8") as handle:
            cls.text = handle.read()
        cls.jobs = jobs_of(cls.text)

    def test_the_jobs_are_closed_to_the_suites_the_always_jobs_the_plan_and_the_gate(self):
        self.assertEqual(set(self.jobs), set(SUITES) | set(ALWAYS) | {"plan", "gate"})
        self.assertEqual(set(self.jobs), set(NAMES))

    def test_each_job_has_its_own_name(self):
        for job, name in NAMES.items():
            self.assertRegex(self.jobs[job], rf"\n    name: {re.escape(name)}\n", job)

    def test_each_suite_waits_for_exactly_the_layers_before_it(self):
        for suite in FIRST:
            want = {"plan"} if suite != "line-limit" else set()
            self.assertEqual(needs_of(self.jobs[suite]), want, suite)
        for suite in SECOND:
            self.assertEqual(needs_of(self.jobs[suite]), {"plan"} | set(FIRST), suite)
        for suite in THIRD:
            self.assertEqual(needs_of(self.jobs[suite]), {"plan"} | set(FIRST) | set(SECOND), suite)
        self.assertEqual(set(FIRST + SECOND + THIRD), set(SUITES) | set(ALWAYS))

    def test_each_suite_condition_is_this_one_exactly(self):
        """`!cancelled()`, its own word of the plan as `!= 'false'`, and the earlier jobs not failed, one by one."""
        for suite in SUITES:
            gates = sorted(needs_of(self.jobs[suite]) - {"plan"})
            want = f"!cancelled() && needs.plan.outputs.{suite} != 'false'" + "".join(f" && needs.{g}.result != 'failure'" for g in gates)
            got = condition_of(self.jobs[suite])
            # the gates are written in the order of `needs: [...]`, which is the order of the layers
            order = [g for g in re.findall(r"needs: \[([^\]]*)\]", self.jobs[suite])[0].split(", ") if g != "plan"]
            want = f"!cancelled() && needs.plan.outputs.{suite} != 'false'" + "".join(f" && needs.{g}.result != 'failure'" for g in order)
            self.assertEqual(got, want, suite)

    def test_a_job_the_plan_does_not_decide_has_no_word_of_the_plan(self):
        for job in ALWAYS:
            self.assertEqual(condition_of(self.jobs[job]), "!cancelled()", job)
            self.assertNotIn("needs.plan", code(self.jobs[job]), job)

    def test_no_job_is_given_a_fixed_condition_or_switched_off(self):
        text = code(self.text)
        for bad in ("continue-on-error", "|| true", "if: false", "if: ${{ false }}", "if: ${{ true }}", "== 'true'"):
            self.assertNotIn(bad, text, bad)

    def test_each_inline_job_runs_its_command_and_no_other_job_does(self):
        for job, marker in RUNS.items():
            self.assertIn(marker, code(self.jobs[job]), f"{job} does not run {marker}")
            for other in self.jobs:
                if other != job:
                    self.assertNotIn(marker, code(self.jobs[other]), f"{other} runs what {job} runs: {marker}")

    def test_each_calling_job_calls_its_workflow_and_nothing_else_is_passed(self):
        for job, called in CALLS.items():
            block = code(self.jobs[job]) + "\n"
            self.assertRegex(block, rf"\n    uses: \./\.github/workflows/{re.escape(called)}\n", job)
            self.assertEqual(len(re.findall(r"\n    uses:", block)), 1, job)
            for word in ("with:", "secrets:", "inherit", "steps:", "env:"):
                self.assertNotIn(word, block, f"{job} passes {word}")
        for job in set(self.jobs) - set(CALLS):
            self.assertNotIn("\n    uses:", code(self.jobs[job]), job)

    def test_the_called_workflows_take_no_input_and_run_only_when_called(self):
        for called in CALLS.values():
            with open(os.path.join(WORKFLOWS, called), encoding="utf-8") as handle:
                text = code(handle.read())
            self.assertIn("\non:\n  workflow_call:\n\npermissions:\n  contents: read\n", text, called)
            for word in ("inputs:", "secrets:", "push:", "pull_request:", "schedule:", "workflow_dispatch:"):
                self.assertNotIn(word, text, f"{called} has {word}")
        called_files = {os.path.basename(p) for p in glob.glob(os.path.join(WORKFLOWS, "ci-*.yml"))}
        self.assertEqual(called_files, set(CALLS.values()))

    def test_the_plan_hands_each_suite_its_own_word_and_no_other(self):
        block = code(self.jobs["plan"])
        listed = re.findall(r"\n      ([a-z0-9-]+): \$\{\{ steps\.plan\.outputs\.([a-z0-9-]+) \}\}", block)
        self.assertEqual(listed, [(suite, suite) for suite in SUITES])

    def test_the_gate_waits_for_every_job_reads_the_needs_whole_and_runs_always(self):
        block = self.jobs["gate"]
        self.assertEqual(needs_of(block), set(self.jobs) - {"gate"})
        self.assertEqual(condition_of(block.replace("always()", "always()")), "always()")
        self.assertIn("          NEEDS: ${{ toJSON(needs) }}\n", block)
        self.assertEqual(len(re.findall(r"needs\.", code(block))), 0, "the gate reads no job on its own")

    def test_the_layers_of_the_map_are_the_ones_of_the_workflow(self):
        self.assertEqual(set(SUITES) | set(ALWAYS), set(FIRST + SECOND + THIRD))

    def test_nothing_in_any_workflow_can_write_to_actions(self):
        for path in glob.glob(os.path.join(WORKFLOWS, "*.yml")):
            with open(path, encoding="utf-8") as handle:
                text = code(handle.read())
            self.assertNotRegex(text, r"actions:\s*write|write-all", os.path.basename(path))

    def test_no_event_value_is_written_into_a_run_text(self):
        for path in glob.glob(os.path.join(WORKFLOWS, "*.yml")):
            with open(path, encoding="utf-8") as handle:
                text = handle.read()
            for m in re.finditer(r"(?m)^(\s*)(?:- )?run:\s*(\|[-+]?|>[-+]?)?\s*(.*)$", text):
                if not m.group(2):
                    self.assertNotRegex(m.group(3), r"\$\{\{\s*github\.event", os.path.basename(path))
                    continue
                indent = len(m.group(1))
                for line in text[m.end() :].splitlines()[1:]:
                    if line.strip() and len(line) - len(line.lstrip()) <= indent:
                        break
                    self.assertNotRegex(line, r"\$\{\{\s*github\.event", os.path.basename(path))


class TreeJudges(unittest.TestCase):
    """What judges the whole tree, or a clock, is not decided by the paths of a change."""

    def read(self, name):
        with open(os.path.join(WORKFLOWS, name), encoding="utf-8") as handle:
            return handle.read()

    def test_the_sign_off_and_the_folder_limit_run_on_every_pull_request(self):
        for name, branches in (("dco.yml", "[main, develop]"), ("folder-limit.yml", "[develop]")):
            text = code(self.read(name))
            self.assertIn(f"on:\n  pull_request:\n    branches: {branches}\n", text, name)
            for bad in ("paths:", "paths-ignore:", "\n    if:", "needs:", "continue-on-error"):
                self.assertNotIn(bad, text, f"{name} has {bad}")

    def test_the_folder_limit_judges_with_the_base_copy_and_the_ceilings_of_the_base(self):
        text = code(self.read("folder-limit.yml"))
        self.assertIn("          BASE: ${{ github.event.pull_request.base.sha }}\n", text)
        self.assertIn('git show "$base:scripts/folder-limit/folder-limit.sh" >"$script"', text)
        self.assertIn('nice -n 15 bash "$script"', text)

    def test_the_dependency_audit_is_not_conditioned_by_paths_and_looks_at_both_branches(self):
        text = code(self.read("audit.yml"))
        self.assertIn("on:\n  pull_request:\n    branches: [develop]\n  push:\n    branches: [develop, main]\n  schedule:\n", text)
        for bad in ("paths:", "paths-ignore:", "continue-on-error", "\n    if:"):
            self.assertNotIn(bad, text, bad)
        self.assertIn("""fromJSON('["main", "develop"]')""", text)
        self.assertIn("          ref: ${{ matrix.ref }}\n", text)

    def test_no_comment_sends_the_reader_outside_the_repository(self):
        """A comment names files of this repository, not a report, a review or a standard held elsewhere."""
        bad = re.compile(r"standards/|ai-context|audit round|review round|\bsession of\b", re.I)
        for pattern in (".github/**/*.yml", "scripts/ci/**/*.*"):
            for path in glob.glob(os.path.join(ROOT, pattern), recursive=True):
                if os.path.isfile(path) and not path.endswith(("test_wiring.py", "test_plan.py")):
                    with open(path, encoding="utf-8") as handle:
                        self.assertIsNone(bad.search(handle.read()), path)

    def test_the_line_limit_is_on_the_whole_tree_and_outside_the_plan(self):
        self.assertEqual(ALWAYS, ["line-limit"])
        self.assertNotIn("line-limit", SUITES)


class BaseCopies(unittest.TestCase):
    """The steps that judge a pull request run the script of the base commit."""

    @classmethod
    def setUpClass(cls):
        with open(os.path.join(WORKFLOWS, "ci.yml"), encoding="utf-8") as handle:
            cls.jobs = jobs_of(handle.read())

    def judge(self, job, step, files_base, files_change, env_extra=None):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, files_base, files_change)
            out = os.path.join(tmp, "out")
            open(out, "w").close()
            env = {"EVENT": "pull_request", "RUNNER_TEMP": tmp, "GITHUB_OUTPUT": out, "NEEDS": "{}"}
            env.update(env_extra or {})
            done = fixture.run(step_run(self.jobs[job], step), **env)
            with open(out) as handle:
                produced = handle.read()
            files = {}
            for path in glob.glob(os.path.join(tmp, "**", "*"), recursive=True):
                if os.path.isfile(path) and os.path.join(tmp, "repo") not in path:
                    with open(path, encoding="utf-8", errors="replace") as handle:
                        files[os.path.relpath(path, tmp)] = handle.read()
            return done, produced, files

    def test_the_plan_runs_the_base_copy_never_the_pull_requests(self):
        base = {"scripts/ci/plan/plan.py": "print('base=true')\n", "scripts/ci/plan/map.toml": "# base\n"}
        change = {"scripts/ci/plan/plan.py": "print('pr=true')\n", "scripts/ci/plan/map.toml": "# pr\n"}
        done, out, _ = self.judge("plan", "Decide which suites the change needs", base, change)
        self.assertEqual((done.returncode, out), (0, "base=true\n"), done.stderr)

    def test_the_plan_of_the_change_that_introduces_it_is_the_only_one_that_falls_back(self):
        change = {"scripts/ci/plan/plan.py": "print('pr=true')\n", "scripts/ci/plan/map.toml": "# pr\n"}
        done, out, _ = self.judge("plan", "Decide which suites the change needs", None, change)
        self.assertEqual((done.returncode, out), (0, "pr=true\n"), done.stderr)

    def test_the_plan_keeps_only_suite_lines_and_passes_its_failure_on(self):
        base = {"scripts/ci/plan/plan.py": "print('a=true')\nprint('::error::x')\nraise SystemExit(1)\n", "scripts/ci/plan/map.toml": "#\n"}
        done, out, _ = self.judge("plan", "Decide which suites the change needs", base, {"x": "1"})
        self.assertNotEqual(done.returncode, 0)
        self.assertEqual(out, "", "nothing reaches the outputs when a line is not suite=true|false")

    def test_the_gate_runs_the_base_copy_never_the_pull_requests(self):
        mark = lambda who: f"import os\nopen(os.environ['RUNNER_TEMP'] + '/who', 'w').write('{who}')\n"
        base = {"scripts/ci/plan/gate.py": mark("base"), "scripts/ci/plan/map.toml": "#\n"}
        change = {"scripts/ci/plan/gate.py": mark("pr"), "scripts/ci/plan/map.toml": "#\n"}
        done, _, files = self.judge("gate", "Every suite did what the plan said", base, change)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(files["who"], "base")

    def test_the_line_limit_runs_the_base_copy_never_the_pull_requests(self):
        step = "Hard limit of 500 code lines per file"
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, {"scripts/ci/line-limit/check.sh": f"echo base > {tmp}/who\n"}, {"scripts/ci/line-limit/check.sh": f"echo pr > {tmp}/who\n"})
            done = fixture.run(step_run(self.jobs["line-limit"], step), EVENT="pull_request", RUNNER_TEMP=tmp)
            self.assertEqual(done.returncode, 0, done.stderr)
            with open(os.path.join(tmp, "who")) as handle:
                self.assertEqual(handle.read().strip(), "base")

    def test_the_sign_off_check_runs_the_base_copy_never_the_pull_requests(self):
        with open(os.path.join(WORKFLOWS, "dco.yml"), encoding="utf-8") as handle:
            dco = jobs_of(handle.read())["dco"]
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, {"scripts/ci/dco/check.sh": f"echo base > {tmp}/who\n"}, {"scripts/ci/dco/check.sh": f"echo pr > {tmp}/who\n"})
            done = fixture.run(step_run(dco, "Signed-off-by on every commit, no evil merge"), BASE_SHA=fixture.base, HEAD_SHA="x", RUNNER_TEMP=tmp)
            self.assertEqual(done.returncode, 0, done.stderr)
            with open(os.path.join(tmp, "who")) as handle:
                self.assertEqual(handle.read().strip(), "base")


if __name__ == "__main__":
    unittest.main()
