#!/usr/bin/env python3
"""Tests of scripts/ci/plan/gate.py.

Run from the repository root:

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

The gate is the only required check that stands for the others, so both
directions are tested: it passes when every suite did what the plan said, and
it fails for each way a suite can do something else, including the way GitHub
reports as a success: a job skipped because one before it failed.
"""

import importlib.util
import json
import os
import subprocess
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
MAP = os.path.join(HERE, "map.toml")

spec = importlib.util.spec_from_file_location("gate", os.path.join(HERE, "gate.py"))
gate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gate)

SUITES = ["lint", "unit", "e2e"]


def needs(plan="success", wanted=None, results=None, suites=SUITES):
    """A `needs` object. `wanted` is what the plan said, `results` what ran."""
    wanted = wanted or {}
    results = results or {}
    out = {"plan": {"result": plan, "outputs": {s: wanted.get(s, "false") for s in suites}}}
    for s in suites:
        default = "success" if wanted.get(s) == "true" else "skipped"
        out[s] = {"result": results.get(s, default), "outputs": {}}
    return out


class Verdicts(unittest.TestCase):
    def check(self, n, suites=SUITES):
        return gate.verdicts(n, suites)

    def test_everything_planned_ran_and_the_rest_was_skipped(self):
        self.assertEqual(self.check(needs(wanted={"lint": "true", "unit": "true"})), [])

    def test_nothing_planned_and_everything_skipped(self):
        self.assertEqual(self.check(needs()), [])

    def test_a_planned_suite_that_failed(self):
        problems = self.check(needs(wanted={"unit": "true"}, results={"unit": "failure"}))
        self.assertEqual(len(problems), 1)
        self.assertIn("unit", problems[0])

    def test_a_planned_suite_that_was_cancelled(self):
        self.assertTrue(self.check(needs(wanted={"e2e": "true"}, results={"e2e": "cancelled"})))

    def test_a_planned_suite_that_was_skipped_because_one_before_it_failed(self):
        self.assertTrue(self.check(needs(wanted={"e2e": "true"}, results={"e2e": "skipped"})))

    def test_a_suite_that_ran_when_nothing_of_its_own_changed(self):
        self.assertTrue(self.check(needs(results={"lint": "success"})))

    def test_a_suite_nobody_planned_that_failed(self):
        self.assertTrue(self.check(needs(results={"lint": "failure"})))

    def test_each_suite_is_judged_by_its_own_result_and_by_no_other(self):
        """With every suite planned, the one that failed is the one named."""
        for failed in SUITES:
            wanted = {s: "true" for s in SUITES}
            results = {s: ("failure" if s == failed else "success") for s in SUITES}
            problems = self.check(needs(wanted=wanted, results=results))
            self.assertEqual(len(problems), 1, failed)
            self.assertTrue(problems[0].startswith(f"{failed}:"), problems)

    def test_each_suite_is_judged_by_its_own_word_of_the_plan_and_by_no_other(self):
        """Only one suite planned, the others skipped: a skipped one that ran is named."""
        for planned in SUITES:
            wanted = {planned: "true"}
            results = {s: ("success" if s == planned else "skipped") for s in SUITES}
            self.assertEqual(self.check(needs(wanted=wanted, results=results)), [], planned)
            for ran in set(SUITES) - {planned}:
                bad = dict(results, **{ran: "success"})
                problems = self.check(needs(wanted=wanted, results=bad))
                self.assertEqual(len(problems), 1, (planned, ran))
                self.assertTrue(problems[0].startswith(f"{ran}:"), problems)

    def test_a_job_that_runs_on_every_change_has_to_succeed(self):
        for result in ("failure", "cancelled", "skipped"):
            n = needs()
            n["always"] = {"result": result, "outputs": {}}
            self.assertTrue(gate.verdicts(n, SUITES, ["always"]), result)
        n = needs()
        n["always"] = {"result": "success", "outputs": {}}
        self.assertEqual(gate.verdicts(n, SUITES, ["always"]), [])

    def test_a_job_that_runs_on_every_change_and_is_missing(self):
        self.assertTrue(gate.verdicts(needs(), SUITES, ["always"]))

    def test_a_cancelled_job_fails_the_gate_whatever_the_plan_said(self):
        self.assertTrue(self.check(needs(results={"lint": "cancelled"})))
        self.assertTrue(self.check(needs(wanted={"lint": "true"}, results={"lint": "cancelled"})))

    def test_a_plan_that_did_not_succeed_fails_whatever_else_says(self):
        for result in ("failure", "cancelled", "skipped"):
            self.assertTrue(self.check(needs(plan=result)), result)

    def test_a_missing_plan(self):
        n = needs()
        del n["plan"]
        self.assertTrue(self.check(n))

    def test_a_suite_missing_from_the_needs(self):
        n = needs(wanted={"lint": "true"})
        del n["e2e"]
        self.assertTrue(self.check(n))

    def test_a_job_the_map_does_not_know(self):
        n = needs()
        n["extra"] = {"result": "success", "outputs": {}}
        self.assertTrue(self.check(n))

    def test_a_plan_that_printed_something_else(self):
        n = needs()
        n["plan"]["outputs"]["lint"] = "maybe"
        self.assertTrue(self.check(n))
        n["plan"]["outputs"].pop("lint")
        self.assertTrue(self.check(n))


class Command(unittest.TestCase):
    def run_gate(self, env_needs):
        env = dict(os.environ)
        if env_needs is None:
            env.pop("NEEDS", None)
        else:
            env["NEEDS"] = env_needs
        return subprocess.run([sys.executable, "-I", os.path.join(HERE, "gate.py"), "--map", MAP], env=env, capture_output=True, text=True)

    def real(self, wanted, results):
        with open(MAP, "rb") as handle:
            import tomllib

            data = tomllib.load(handle)
        suites = list(data["suites"])
        out = needs(wanted=wanted, results=results, suites=suites)
        for job in data["always"]:
            out[job] = {"result": results.get(job, "success"), "outputs": {}}
        return json.dumps(out)

    def test_passes_when_nothing_is_planned_and_nothing_ran(self):
        done = self.run_gate(self.real({}, {}))
        self.assertEqual(done.returncode, 0, done.stdout)

    def test_fails_when_the_job_that_runs_on_every_change_failed(self):
        done = self.run_gate(self.real({}, {"line-limit": "failure"}))
        self.assertEqual(done.returncode, 1)

    def test_fails_for_a_planned_suite_that_failed(self):
        done = self.run_gate(self.real({"unit": "true"}, {"unit": "failure"}))
        self.assertEqual(done.returncode, 1)
        self.assertIn("::error::", done.stdout)

    def test_fails_without_needs_or_with_garbage(self):
        self.assertEqual(self.run_gate(None).returncode, 1)
        self.assertEqual(self.run_gate("not json").returncode, 1)

    def test_fails_without_a_map(self):
        done = subprocess.run([sys.executable, "-I", os.path.join(HERE, "gate.py")], env=dict(os.environ, NEEDS="{}"), capture_output=True, text=True)
        self.assertEqual(done.returncode, 2)


if __name__ == "__main__":
    unittest.main()
