#!/usr/bin/env python3
"""Tests of how ci.yml is wired to the map and the gate, and of the names the
rulesets require.

Run from the repository root, with PyYAML (hash-pinned in requirements.txt):

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

The workflows are read with a real YAML parser that refuses a key written twice
(wiring_support.py). The shape is fixed exactly: a job has its own name, command
and condition, written there a second time, so crossing the `run:` or the `if:` of
two suites, handing one a fixed `false`, crossing the plan variables, reading
another job's result in the gate, or adding a job turns a test red. No test
exempts a job by name: the set of jobs is closed.
"""

import os
import re
import tempfile
import unittest

import yaml

from wiring_support import (
    AUDIT_NAME,
    GATE_NAME,
    ALWAYS,
    CALLED,
    FILES,
    FIRST,
    Fixture,
    HERE,
    NAMES,
    REQUIRED,
    ROOT,
    RUNS,
    SECOND,
    OPTIONAL,
    SUITES,
    StrictLoader,
    THIRD,
    _mapping,
    enumerate_files,
    present_always,
    present_suites,
    load,
    names_of,
    resolved_name,
    runs_of,
    step_named,
    tracked,
    triggers,
    varies_with_base,
    walk,
)

PRESENT = present_suites()
PRESENT_ALWAYS = present_always()


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
        self.assertEqual(set(self.jobs), set(PRESENT) | set(PRESENT_ALWAYS) | {"plan", "gate"})
        self.assertEqual(set(self.jobs), set(NAMES))
        self.assertEqual(set(FIRST + SECOND + THIRD), set(PRESENT) | set(PRESENT_ALWAYS))

    def test_a_suite_without_a_job_is_an_optional_one_and_the_list_is_closed(self):
        """Between the pull request that teaches the base a job and the one that adds it."""
        self.assertLessEqual((set(SUITES) | set(ALWAYS)) - (set(PRESENT) | set(PRESENT_ALWAYS)), set(OPTIONAL))
        self.assertEqual(OPTIONAL, ["commit-checks"], "the third pull request takes the name off the map and this list")

    def test_each_job_has_its_own_name(self):
        for job, name in NAMES.items():
            self.assertEqual(self.jobs[job]["name"], name, job)

    def test_each_suite_waits_for_exactly_the_layers_before_it(self):
        for suite in FIRST:
            self.assertEqual(set(self.jobs[suite].get("needs", [])), {"plan"} if suite not in ALWAYS else set(), suite)
        for suite in SECOND:
            self.assertEqual(self.jobs[suite]["needs"], ["plan"] + FIRST, suite)
        for suite in THIRD:
            self.assertEqual(self.jobs[suite]["needs"], ["plan"] + FIRST + SECOND, suite)

    def test_each_suite_condition_is_this_one_exactly(self):
        """`!cancelled()`, its own word of the plan as `!= 'false'`, and the earlier jobs not failed, one by one."""
        for suite in PRESENT:
            gates = [n for n in self.jobs[suite]["needs"] if n != "plan"]
            want = f"${{{{ !cancelled() && needs.plan.outputs.{suite} != 'false'" + "".join(f" && needs.{g}.result != 'failure'" for g in gates) + " }}"
            self.assertEqual(self.jobs[suite]["if"], want, suite)

    def test_a_job_the_plan_does_not_decide_has_no_word_of_the_plan(self):
        for job in PRESENT_ALWAYS:
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
        self.assertEqual(self.jobs["plan"]["outputs"], {s: f"${{{{ steps.plan.outputs.{s} }}}}" for s in PRESENT})

    def test_the_gate_waits_for_every_job_reads_the_needs_whole_and_runs_always(self):
        gate = self.jobs["gate"]
        self.assertEqual(sorted(gate["needs"]), sorted(set(self.jobs) - {"gate"}))
        self.assertEqual(gate["if"], "${{ always() }}")
        step = step_named(gate, "Every suite did what the plan said")
        self.assertEqual(step["env"], {"EVENT": "${{ github.event_name }}", "BASE_REF": "${{ github.event.pull_request.base.ref }}", "NEEDS": "${{ toJSON(needs) }}"})
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
    def test_no_required_check_is_produced_by_more_than_one_workflow_event_or_base(self):
        """Every job names itself for each trigger of its workflow, and for each base of a pull request.

        A job with `if:` still counts: a job that is skipped is shown with its name,
        and a skipped check counts as passed. The comparison does not tell upper
        from lower case, as GitHub does not, and the jobs inside the reusable
        workflows are read too, with the name of the job that calls them in front. A
        name with an expression is refused unless it is one of the two known.
        """
        required = {name.casefold(): name for name in REQUIRED}
        producers = {name: [] for name in REQUIRED}
        for path in sorted(FILES):
            doc = load(path)
            if "jobs" not in doc:
                continue
            events = triggers(doc)
            for body in doc["jobs"].values():
                for event, config in events.items():
                    if event == "workflow_call":
                        continue
                    bases = (config or {}).get("branches", [None]) if event == "pull_request" else [None]
                    for base in bases:
                        for name in names_of(body, event, base, load):
                            if name.casefold() in required:
                                exact = required[name.casefold()]
                                self.assertEqual(name, exact, f"{path}: {name!r} differs from {exact!r} only in case")
                                key = base if (event == "pull_request" and varies_with_base(body)) else None
                                if (os.path.basename(path), event, key) not in producers[exact]:
                                    producers[exact].append((os.path.basename(path), event, key))
        for name, want in REQUIRED.items():
            self.assertEqual(producers[name], [want], name)

    def test_a_name_with_an_expression_is_one_of_the_known_two(self):
        for path in sorted(FILES):
            for body in load(path).get("jobs", {}).values():
                name = body.get("name", "")
                if "${{" in name and name not in (GATE_NAME, AUDIT_NAME):
                    self.assertRegex(name, r"^[^$]*\$\{\{ matrix\.[a-z-]+ \}\}[^$]*$", f"{path}: {name}")

    def test_the_names_of_the_called_workflows_are_read_with_the_name_of_their_caller(self):
        jobs = load(".github/workflows/ci.yml")["jobs"]
        self.assertEqual(names_of(jobs["e2e"], "pull_request", "develop", load), ["e2e", "e2e / e2e"])
        self.assertEqual(names_of(jobs["container"], "pull_request", "develop", load), ["container", "container / Build and smoke-test image"])

    def test_a_name_that_differs_only_in_case_is_a_collision(self):
        job = {"name": "CI Gate"}
        self.assertEqual(names_of(job, "pull_request", "develop", load)[0].casefold(), "ci gate")
        self.assertNotEqual(names_of(job, "pull_request", "develop", load)[0], "ci gate")

    def test_the_gate_is_named_for_its_event_and_its_base(self):
        gate = load(".github/workflows/ci.yml")["jobs"]["gate"]
        for event in ("push", "schedule", "workflow_dispatch"):
            self.assertEqual(resolved_name(gate, event), f"ci gate ({event})")
        self.assertEqual(resolved_name(gate, "pull_request", "develop"), "ci gate")
        self.assertEqual(resolved_name(gate, "pull_request", "main"), "ci gate (main)")
        self.assertEqual(resolved_name(gate, "pull_request", "feature"), "ci gate (other)")
        self.assertNotIn("edited", triggers(load(".github/workflows/ci.yml"))["pull_request"])

    def test_an_expression_does_not_tell_develop_from_Develop_so_the_trigger_and_the_step_do(self):
        gate = load(".github/workflows/ci.yml")["jobs"]["gate"]
        for base in ("Develop", "DEVELOP", "MAIN", "Main"):
            # the model of `==` takes the variant for the real branch...
            self.assertIn(resolved_name(gate, "pull_request", base), ("ci gate", "ci gate (main)"), base)
            # ...which is why the trigger, whose filter does tell them apart, never lets it in
            for path in ("ci.yml", "audit.yml"):
                self.assertNotIn(base, triggers(load(f".github/workflows/{path}"))["pull_request"]["branches"], path)
        self.assertEqual(triggers(load(".github/workflows/ci.yml"))["pull_request"]["branches"], ["develop", "main"])
        step = step_named(gate, "Every suite did what the plan said")
        self.assertEqual(step["env"], {"EVENT": "${{ github.event_name }}", "BASE_REF": "${{ github.event.pull_request.base.ref }}", "NEEDS": "${{ toJSON(needs) }}"})
        for base, ok in (("develop", True), ("main", True), ("Develop", False), ("MAIN", False), ("feature", False), ("", False)):
            with tempfile.TemporaryDirectory() as tmp:
                fixture = Fixture(tmp, {"scripts/ci/plan/gate.py": "pass\n", "scripts/ci/plan/map.toml": "#\n"}, {"x": "1"})
                done = fixture.run(step["run"], EVENT="pull_request", BASE_REF=base, RUNNER_TEMP=tmp, NEEDS="{}")
                self.assertEqual(done.returncode == 0, ok, f"{base!r}: {done.stderr}")

    def test_the_promotion_into_main_runs_every_suite(self):
        step = step_named(load(".github/workflows/ci.yml")["jobs"]["plan"], "Decide which suites the change needs")
        self.assertEqual(step["env"], {"EVENT": "${{ github.event_name }}", "BASE_REF": "${{ github.event.pull_request.base.ref }}"})
        self.assertIn('if [ "$EVENT" = pull_request ] && [ "$BASE_REF" = main ]; then plan_event=promotion; fi', step["run"])
        self.assertIn('--event "$plan_event"', step["run"])


if __name__ == "__main__":
    unittest.main()
