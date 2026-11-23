#!/usr/bin/env python3
"""Tests of the `commit checks` job of ci.yml.

Run from the repository root, with PyYAML (hash-pinned in requirements.txt):

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

The job reads the commits of a pull request for credentials and personal addresses.
What the scripts find is tested in scripts/ci/hygiene; here is how the job is
wired: it runs the scripts of the base commit, it reads the whole history, it
fails when one script fails, and it has nothing to judge on a push.
"""

import os
import tempfile
import unittest

from wiring_support import Fixture, load, step_named

TOOLS = ("check-secrets", "check-commit-identity")


class CommitChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.job = load(".github/workflows/ci.yml")["jobs"]["commit-checks"]
        cls.step = step_named(cls.job, "Credentials and personal addresses in the commits of the pull request")

    def run_step(self, fixture, tmp, **env):
        return fixture.run(self.step["run"], BASE_SHA=fixture.base, HEAD_SHA=fixture.git("rev-parse", "HEAD"), TMPDIR=tmp, **env)

    def script(self, tmp, tool, who, status=0):
        return f"echo {who}-{tool} >> {tmp}/ran\nexit {status}\n"

    def test_the_job_reads_the_whole_history_and_judges_only_a_pull_request(self):
        checkout = self.job["steps"][0]
        self.assertEqual(checkout["with"], {"fetch-depth": 0, "persist-credentials": False})
        self.assertEqual(self.step["if"], "github.event_name == 'pull_request'")
        self.assertEqual(self.step["env"], {"BASE_SHA": "${{ github.event.pull_request.base.sha }}", "HEAD_SHA": "${{ github.event.pull_request.head.sha }}"})
        self.assertEqual(len(self.job["steps"]), 2)

    def test_the_scripts_of_the_base_commit_judge_never_those_of_the_pull_request(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = {f"scripts/ci/hygiene/{t}.sh": self.script(tmp, t, "base") for t in TOOLS}
            change = {f"scripts/ci/hygiene/{t}.sh": self.script(tmp, t, "pr") for t in TOOLS}
            done = self.run_step(Fixture(tmp, base, change), tmp)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            with open(os.path.join(tmp, "ran")) as handle:
                self.assertEqual(sorted(handle.read().split()), ["base-check-commit-identity", "base-check-secrets"])

    def test_the_change_that_introduces_the_scripts_is_judged_by_them(self):
        with tempfile.TemporaryDirectory() as tmp:
            change = {f"scripts/ci/hygiene/{t}.sh": self.script(tmp, t, "pr") for t in TOOLS}
            done = self.run_step(Fixture(tmp, {"unrelated": "x"}, change), tmp)
            self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
            with open(os.path.join(tmp, "ran")) as handle:
                self.assertEqual(sorted(handle.read().split()), ["pr-check-commit-identity", "pr-check-secrets"])

    def test_one_script_that_fails_fails_the_step_and_the_other_still_runs(self):
        for failing in TOOLS:
            with tempfile.TemporaryDirectory() as tmp:
                base = {f"scripts/ci/hygiene/{t}.sh": self.script(tmp, t, "base", 1 if t == failing else 0) for t in TOOLS}
                done = self.run_step(Fixture(tmp, base, {"x": "y"}), tmp)
                self.assertNotEqual(done.returncode, 0, failing)
                with open(os.path.join(tmp, "ran")) as handle:
                    self.assertEqual(len(handle.read().split()), 2, failing)

    def test_a_base_commit_that_cannot_be_read_stops_the_step(self):
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, {"unrelated": "x"}, {"x": "y"})
            done = fixture.run(self.step["run"], BASE_SHA="0" * 40, HEAD_SHA=fixture.git("rev-parse", "HEAD"), TMPDIR=tmp)
            self.assertNotEqual(done.returncode, 0)
            self.assertFalse(os.path.exists(os.path.join(tmp, "ran")))


if __name__ == "__main__":
    unittest.main()
