#!/usr/bin/env python3
"""Tests of how the workflows are wired to the map and the gate.

Run from the repository root, with PyYAML (hash-pinned in requirements.txt):

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

The workflows are read with a real YAML parser that refuses a key written twice,
so a line the tests do not look at cannot hide a second meaning that GitHub
would run. One function lists every workflow and every action of the tree, with
both suffixes, and the list is closed: a file that is not in it fails.

The shape is fixed exactly. A job has its own name, command and condition, written
here a second time, so crossing the `run:` or the `if:` of two suites, handing
one a fixed `false`, crossing the plan variables, reading another job's result in
the gate, or adding a job turns a test red. The steps that read a script of the
base commit run in a throwaway repository with a script on each side and must run
the base's. No test exempts a job by name: the set of jobs is closed.
"""

import os
import re
import subprocess
import tempfile
import tomllib
import unittest

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

with open(os.path.join(HERE, "map.toml"), "rb") as handle:
    DATA = tomllib.load(handle)
SUITES = list(DATA["suites"])
ALWAYS = list(DATA["always"])

FIRST = ["line-limit", "actionlint", "bun-version", "ci-scripts", "lint"]
SECOND = ["unit", "randomized", "debian", "release-scripts"]
THIRD = ["e2e", "container"]

# Every workflow and every action of the tree; nothing else may exist.
FILES = {
    ".github/workflows/audit.yml",
    ".github/workflows/ci-container.yml",
    ".github/workflows/ci-debian.yml",
    ".github/workflows/ci-e2e.yml",
    ".github/workflows/ci-release-scripts.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/codeql.yml",
    ".github/workflows/dco.yml",
    ".github/workflows/dependabot-watch.yml",
    ".github/workflows/folder-limit.yml",
    ".github/workflows/main-guard.yml",
    ".github/workflows/pins.yml",
    ".github/workflows/release.yml",
}
CALLED = {
    "debian": "ci-debian.yml",
    "release-scripts": "ci-release-scripts.yml",
    "e2e": "ci-e2e.yml",
    "container": "ci-container.yml",
}
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
    "gate": "${{ github.event_name == 'pull_request' && 'ci gate' || format('ci gate ({0})', github.event_name) }}",
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
# The checks the rulesets require, and the one event each is produced for.
REQUIRED = {
    "ci gate": ("ci.yml", "pull_request"),
    "dco / Signed-off-by present on every commit": ("dco.yml", "pull_request"),
    "folder limit": ("folder-limit.yml", "pull_request"),
    "develop-only": ("main-guard.yml", "pull_request"),
}


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


def tracked():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True).stdout
    return [p.decode() for p in out.split(b"\0") if p]


def enumerate_files():
    """The one list of workflows and actions: .yml and .yaml, and action files anywhere."""
    found = set()
    for path in tracked():
        if re.match(r"^\.github/.*\.ya?ml$", path) and path != ".github/dependabot.yml":
            found.add(path)
        if re.search(r"(^|/)action\.ya?ml$", path):
            found.add(path)
    return found


def load(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
        return yaml.load(handle, Loader=StrictLoader)


def triggers(doc):
    """The `on:` mapping; YAML 1.1 reads the bare key `on` as true."""
    on = doc.get("on", doc.get(True))
    return on if isinstance(on, dict) else {name: None for name in ([on] if isinstance(on, str) else on)}


def walk(node):
    yield node
    if isinstance(node, dict):
        for value in node.values():
            yield from walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk(value)


def runs_of(job):
    return "\n".join(step["run"] for step in job.get("steps", []) if "run" in step)


def step_named(job, name):
    found = [s for s in job["steps"] if s.get("name") == name]
    assert len(found) == 1, f"{len(found)} steps named {name!r}"
    return found[0]


def resolved_name(job, event):
    name = job.get("name", "")
    if name == NAMES["gate"]:
        return "ci gate" if event == "pull_request" else f"ci gate ({event})"
    return name


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
        return subprocess.run(["git", "-C", self.dir, *args], check=True, capture_output=True, text=True).stdout.strip()

    def write(self, files):
        for path, text in files.items():
            full = os.path.join(self.dir, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as handle:
                handle.write(text)

    def run(self, script, **env):
        return subprocess.run(["bash", "-c", script], cwd=self.dir, env=dict(os.environ, **env), capture_output=True, text=True)


class Reader(unittest.TestCase):
    def test_the_list_of_workflows_and_actions_is_closed_and_has_both_suffixes(self):
        self.assertEqual(enumerate_files(), FILES)

    def test_every_workflow_loads_and_none_writes_a_key_twice(self):
        for path in sorted(FILES):
            self.assertIsInstance(load(path), dict, path)

    def test_the_loader_refuses_a_key_written_twice(self):
        with self.assertRaises(yaml.constructor.ConstructorError):
            yaml.load("jobs:\n  a:\n    if: ${{ true }}\n    if: ${{ false }}\n", Loader=StrictLoader)

    def test_the_enumerator_sees_yaml_and_action_files_wherever_they_are(self):
        for case in (".github/workflows/x.yaml", ".github/actions/y/action.yml", "tools/z/action.yaml", ".github/workflows/sub/w.yml"):
            self.assertTrue(re.match(r"^\.github/.*\.ya?ml$", case) or re.search(r"(^|/)action\.ya?ml$", case), case)


class Wiring(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = load(".github/workflows/ci.yml")
        cls.jobs = cls.doc["jobs"]

    def test_the_triggers_are_these_and_the_permissions_read_only(self):
        self.assertEqual(
            triggers(self.doc),
            {"push": {"branches": ["main", "develop"]}, "pull_request": {"branches": ["develop", "main"]}},
        )
        self.assertEqual(self.doc["permissions"], {"contents": "read"})

    def test_the_jobs_are_closed_to_the_suites_the_always_jobs_the_plan_and_the_gate(self):
        self.assertEqual(set(self.jobs), set(SUITES) | set(ALWAYS) | {"plan", "gate"})
        self.assertEqual(set(self.jobs), set(NAMES))
        self.assertEqual(set(FIRST + SECOND + THIRD), set(SUITES) | set(ALWAYS))

    def test_each_job_has_its_own_name(self):
        for job, name in NAMES.items():
            self.assertEqual(self.jobs[job]["name"], name, job)

    def test_each_suite_waits_for_exactly_the_layers_before_it(self):
        for suite in FIRST:
            self.assertEqual(set(self.jobs[suite].get("needs", [])), {"plan"} if suite != "line-limit" else set(), suite)
        for suite in SECOND:
            self.assertEqual(self.jobs[suite]["needs"], ["plan"] + FIRST, suite)
        for suite in THIRD:
            self.assertEqual(self.jobs[suite]["needs"], ["plan"] + FIRST + SECOND, suite)

    def test_each_suite_condition_is_this_one_exactly(self):
        """`!cancelled()`, its own word of the plan as `!= 'false'`, and the earlier jobs not failed, one by one."""
        for suite in SUITES:
            gates = [n for n in self.jobs[suite]["needs"] if n != "plan"]
            want = f"${{{{ !cancelled() && needs.plan.outputs.{suite} != 'false'" + "".join(f" && needs.{g}.result != 'failure'" for g in gates) + " }}"
            self.assertEqual(self.jobs[suite]["if"], want, suite)

    def test_a_job_the_plan_does_not_decide_has_no_word_of_the_plan(self):
        for job in ALWAYS:
            self.assertEqual(self.jobs[job]["if"], "${{ !cancelled() }}", job)
            self.assertNotIn("needs", self.jobs[job], job)

    def test_nothing_in_any_workflow_switches_a_job_off(self):
        for path in sorted(FILES):
            for node in walk(load(path)):
                if isinstance(node, dict):
                    self.assertNotIn("continue-on-error", node, path)
                    if "if" in node and isinstance(node["if"], (bool, str)):
                        self.assertNotIn(str(node["if"]).strip("${} ").lower(), ("false", "true"), path)
                    self.assertNotIn("== 'true'", str(node.get("if", "")), path)
                if path.endswith("/ci.yml") and isinstance(node, dict) and isinstance(node.get("run"), str):
                    self.assertNotIn("|| true", node["run"], path)

    def test_each_inline_job_runs_its_command_and_no_other_job_does(self):
        for job, marker in RUNS.items():
            self.assertIn(marker, runs_of(self.jobs[job]), f"{job} does not run {marker}")
            for other, body in self.jobs.items():
                if other != job:
                    self.assertNotIn(marker, runs_of(body), f"{other} runs what {job} runs: {marker}")

    def test_each_calling_job_calls_its_workflow_and_nothing_else_is_passed(self):
        for job, called in CALLED.items():
            body = self.jobs[job]
            self.assertEqual(body["uses"], f"./.github/workflows/{called}", job)
            self.assertEqual(set(body) - {"name", "needs", "if", "uses"}, set(), f"{job} carries more than a call")
        for job in set(self.jobs) - set(CALLED):
            self.assertNotIn("uses", self.jobs[job], job)

    def test_the_called_workflows_take_no_input_and_run_only_when_called(self):
        for called in CALLED.values():
            doc = load(f".github/workflows/{called}")
            self.assertEqual(triggers(doc), {"workflow_call": None}, called)
            self.assertEqual(doc["permissions"], {"contents": "read"}, called)
            self.assertLessEqual(set(doc), {"name", "on", True, "permissions", "jobs", "env"}, called)

    def test_the_plan_hands_each_suite_its_own_word_and_no_other(self):
        self.assertEqual(self.jobs["plan"]["outputs"], {s: f"${{{{ steps.plan.outputs.{s} }}}}" for s in SUITES})

    def test_the_gate_waits_for_every_job_reads_the_needs_whole_and_runs_always(self):
        gate = self.jobs["gate"]
        self.assertEqual(sorted(gate["needs"]), sorted(set(self.jobs) - {"gate"}))
        self.assertEqual(gate["if"], "${{ always() }}")
        step = step_named(gate, "Every suite did what the plan said")
        self.assertEqual(step["env"], {"EVENT": "${{ github.event_name }}", "NEEDS": "${{ toJSON(needs) }}"})
        self.assertNotIn("needs.", step["run"])

    def test_nothing_can_write_to_actions_and_no_tool_is_restored_from_a_cache(self):
        for path in sorted(FILES):
            for node in walk(load(path)):
                if isinstance(node, dict):
                    self.assertNotIn(node.get("actions"), ("write",), path)
                    self.assertNotEqual(node.get("permissions"), "write-all", path)
                    self.assertFalse(str(node.get("uses", "")).startswith("actions/cache"), path)
                    self.assertNotIn("cache", node.get("with", {}) if isinstance(node.get("with"), dict) else {}, path)

    def test_the_security_tool_is_downloaded_and_checked_on_every_run(self):
        step = step_named(self.jobs["actionlint"], "Install actionlint at a verified hash")
        self.assertIn("sha256sum --check --strict", step["run"])
        self.assertIn("releases/download/v${ACTIONLINT_VERSION}", step["run"])

    def test_no_event_value_is_written_into_a_run_text(self):
        for path in sorted(FILES):
            for node in walk(load(path)):
                if isinstance(node, dict) and isinstance(node.get("run"), str):
                    self.assertNotRegex(node["run"], r"\$\{\{\s*github\.event", path)


class RequiredNames(unittest.TestCase):
    def test_no_required_check_is_produced_by_more_than_one_workflow_or_event(self):
        producers = {name: [] for name in REQUIRED}
        for path in sorted(FILES):
            doc = load(path)
            if "jobs" not in doc:
                continue
            events = [e for e in triggers(doc) if e != "workflow_call"]
            for body in doc["jobs"].values():
                for event in events:
                    for name in producers:
                        if resolved_name(body, event) == name:
                            producers[name].append((os.path.basename(path), event))
        for name, want in REQUIRED.items():
            self.assertEqual(producers[name], [want], name)

    def test_the_push_gate_is_named_for_its_event(self):
        for event in ("push", "schedule", "workflow_dispatch"):
            self.assertEqual(resolved_name(load(".github/workflows/ci.yml")["jobs"]["gate"], event), f"ci gate ({event})")

    def test_the_promotion_into_main_runs_every_suite(self):
        step = step_named(load(".github/workflows/ci.yml")["jobs"]["plan"], "Decide which suites the change needs")
        self.assertEqual(step["env"], {"EVENT": "${{ github.event_name }}", "BASE_REF": "${{ github.event.pull_request.base.ref }}"})
        self.assertIn('if [ "$EVENT" = pull_request ] && [ "$BASE_REF" = main ]; then plan_event=promotion; fi', step["run"])
        self.assertIn('--event "$plan_event"', step["run"])


class TreeJudges(unittest.TestCase):
    """What judges the whole tree, or a clock, is not decided by the paths of a change."""

    def test_the_sign_off_and_the_folder_limit_run_on_every_pull_request(self):
        for name, branches in (("dco.yml", ["main", "develop"]), ("folder-limit.yml", ["develop"])):
            doc = load(f".github/workflows/{name}")
            self.assertEqual(triggers(doc), {"pull_request": {"branches": branches}}, name)
            for body in doc["jobs"].values():
                self.assertEqual(set(body) & {"if", "needs", "continue-on-error", "strategy"}, set(), name)

    def test_the_folder_limit_judges_with_the_base_copy_and_the_ceilings_of_the_base(self):
        job = load(".github/workflows/folder-limit.yml")["jobs"]["folder-limit"]
        step = step_named(job, "Check direct file counts with the base gate")
        self.assertEqual(step["env"], {"BASE": "${{ github.event.pull_request.base.sha }}"})
        self.assertIn('git show "$base:scripts/folder-limit/folder-limit.sh" >"$script"', step["run"])
        self.assertIn('nice -n 15 bash "$script"', step["run"])

    def test_the_dependency_audit_is_not_conditioned_by_paths_and_looks_at_both_branches(self):
        doc = load(".github/workflows/audit.yml")
        self.assertEqual(
            triggers(doc),
            {
                "pull_request": {"branches": ["develop"]},
                "push": {"branches": ["develop", "main"]},
                "schedule": [{"cron": "23 6 * * 1"}],
                "workflow_dispatch": None,
            },
        )
        job = doc["jobs"]["audit"]
        self.assertEqual(set(job) & {"if", "needs", "continue-on-error"}, set())
        self.assertEqual(job["strategy"]["fail-fast"], False)
        self.assertEqual(job["strategy"]["matrix"]["ref"], """${{ github.event_name == 'schedule' && fromJSON('["main", "develop"]') || fromJSON('[""]') }}""")
        self.assertEqual(job["steps"][0]["with"], {"ref": "${{ matrix.ref }}", "persist-credentials": False})

    def test_the_action_pins_check_runs_when_a_workflow_changes_and_every_week(self):
        doc = load(".github/workflows/pins.yml")
        self.assertEqual(
            triggers(doc),
            {
                "pull_request": {"branches": ["develop"], "paths": [".github/**", "**/action.yml", "**/action.yaml"]},
                "schedule": [{"cron": "29 6 * * 1"}],
                "workflow_dispatch": None,
            },
        )
        job = doc["jobs"]["pins"]
        self.assertEqual(set(job) & {"if", "needs", "continue-on-error"}, set())
        self.assertIn("scripts/ci/pins/check.test.sh", step_named(job, "Lint and test the check")["run"])

    def test_the_line_limit_is_on_the_whole_tree_and_outside_the_plan(self):
        self.assertEqual(ALWAYS, ["line-limit"])
        self.assertNotIn("line-limit", SUITES)

    def test_no_comment_sends_the_reader_outside_the_repository(self):
        """A comment names files of this repository, not a report, a review or a standard held elsewhere."""
        bad = re.compile(r"standards/|ai-context|audit round|review round|\bsession of\b", re.I)
        for path in tracked():
            if (path.startswith(".github/") or path.startswith("scripts/ci/")) and not path.endswith(("test_wiring.py", "test_plan.py")):
                with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
                    self.assertIsNone(bad.search(handle.read()), path)


class BaseCopies(unittest.TestCase):
    """The steps that judge a pull request run the script of the base commit."""

    @classmethod
    def setUpClass(cls):
        cls.jobs = load(".github/workflows/ci.yml")["jobs"]

    def judge(self, job, step, files_base, files_change, env_extra=None, jobs=None):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, files_base, files_change)
            out = os.path.join(tmp, "out")
            open(out, "w").close()
            env = {"EVENT": "pull_request", "BASE_REF": "develop", "RUNNER_TEMP": tmp, "GITHUB_OUTPUT": out, "NEEDS": "{}"}
            env.update(env_extra or {})
            done = fixture.run(step_named((jobs or self.jobs)[job], step)["run"], **env)
            with open(out) as handle:
                produced = handle.read()
            files = {}
            for dirpath, _, names in os.walk(tmp):
                if os.path.join(tmp, "repo") in dirpath:
                    continue
                for name in names:
                    with open(os.path.join(dirpath, name), encoding="utf-8", errors="replace") as handle:
                        files[os.path.relpath(os.path.join(dirpath, name), tmp)] = handle.read()
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

    def test_a_pull_request_into_main_asks_the_plan_for_the_promotion(self):
        script = "import sys\nprint('promotion=' + ('true' if sys.argv[sys.argv.index('--event') + 1] == 'promotion' else 'false'))\n"
        files = {"scripts/ci/plan/plan.py": script, "scripts/ci/plan/map.toml": "#\n"}
        for base_ref, want in (("main", "promotion"), ("develop", "pull_request")):
            done, out, _ = self.judge("plan", "Decide which suites the change needs", files, {"x": "1"}, {"BASE_REF": base_ref})
            self.assertEqual(out, f"promotion={'true' if want == 'promotion' else 'false'}\n", base_ref)

    def test_the_gate_runs_the_base_copy_never_the_pull_requests(self):
        def mark(who):
            return f"import os\nopen(os.environ['RUNNER_TEMP'] + '/who', 'w').write('{who}')\n"

        base = {"scripts/ci/plan/gate.py": mark("base"), "scripts/ci/plan/map.toml": "#\n"}
        change = {"scripts/ci/plan/gate.py": mark("pr"), "scripts/ci/plan/map.toml": "#\n"}
        done, _, files = self.judge("gate", "Every suite did what the plan said", base, change)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(files["who"], "base")

    def test_the_line_limit_runs_the_base_copy_never_the_pull_requests(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, {"scripts/ci/line-limit/check.sh": f"echo base > {tmp}/who\n"}, {"scripts/ci/line-limit/check.sh": f"echo pr > {tmp}/who\n"})
            step = step_named(self.jobs["line-limit"], "Hard limit of 500 code lines per file")
            done = fixture.run(step["run"], EVENT="pull_request", RUNNER_TEMP=tmp)
            self.assertEqual(done.returncode, 0, done.stderr)
            with open(os.path.join(tmp, "who")) as handle:
                self.assertEqual(handle.read().strip(), "base")

    def test_the_action_pins_check_runs_the_base_copy_never_the_pull_requests(self):
        job = load(".github/workflows/pins.yml")["jobs"]["pins"]
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, {"scripts/ci/pins/check.sh": f"echo base > {tmp}/who\n"}, {"scripts/ci/pins/check.sh": f"echo pr > {tmp}/who\n"})
            done = fixture.run(step_named(job, "Every reference is fixed to a commit or a digest")["run"], EVENT="pull_request", RUNNER_TEMP=tmp)
            self.assertEqual(done.returncode, 0, done.stderr)
            with open(os.path.join(tmp, "who")) as handle:
                self.assertEqual(handle.read().strip(), "base")

    def test_the_sign_off_check_runs_the_base_copy_never_the_pull_requests(self):
        job = load(".github/workflows/dco.yml")["jobs"]["dco"]
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, {"scripts/ci/dco/check.sh": f"echo base > {tmp}/who\n"}, {"scripts/ci/dco/check.sh": f"echo pr > {tmp}/who\n"})
            done = fixture.run(step_named(job, "Signed-off-by on every commit, no evil merge")["run"], BASE_SHA=fixture.base, HEAD_SHA="x", RUNNER_TEMP=tmp)
            self.assertEqual(done.returncode, 0, done.stderr)
            with open(os.path.join(tmp, "who")) as handle:
                self.assertEqual(handle.read().strip(), "base")


if __name__ == "__main__":
    unittest.main()
