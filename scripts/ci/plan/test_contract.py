#!/usr/bin/env python3
"""The contract of the workflows: every one equals its reference copy, and none uses
a property the contract does not know.

Run from the repository root, with PyYAML (hash-pinned in requirements.txt):

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

The tests of test_wiring.py and test_judges.py look at the properties that matter
most one by one. This one holds the whole of each file, so that what they do not
look at cannot change: a `run:` that echoes the command it should run, a condition
that leaves a step out, a `shell:` that ends the step before it reads its script,
`continue-on-error`, the `ref` of a checkout, `defaults`, an `env` that moves a
base commit. A change to a workflow is also a change to its reference copy
(scripts/ci/plan/refresh_reference.py writes them), and both show in the pull
request. What no test here can do is stop a pull request from changing the workflow,
the copy and this test together; the answer to that is review, and a validator held
by the base branch.
"""

import difflib
import os
import unittest

from wiring_support import FILES, REFERENCE, ROOT, dump_reference, load, walk

JOB_KEYS = {"name", "needs", "if", "uses", "runs-on", "timeout-minutes", "steps", "outputs", "defaults", "env", "permissions", "strategy", "concurrency"}
STEP_KEYS = {"name", "id", "uses", "with", "run", "env", "working-directory", "if"}
# The one checkout of another ref: the release gate, with a literal.
CHECKOUT_REF = {(".github/workflows/release.yml", "verify"): "main"}


class Contract(unittest.TestCase):
    def test_the_references_are_exactly_the_workflows(self):
        self.assertEqual(sorted(os.listdir(REFERENCE)), sorted(os.path.basename(p) for p in FILES))

    def test_every_workflow_equals_its_reference_copy(self):
        for path in sorted(FILES):
            ours = load(path)
            with open(os.path.join(REFERENCE, os.path.basename(path)), encoding="utf-8") as handle:
                theirs = load(os.path.relpath(handle.name, ROOT))
            if ours != theirs:
                diff = "\n".join(difflib.unified_diff(dump_reference(theirs).splitlines(), dump_reference(ours).splitlines(), "reference", path, lineterm="", n=2))
                self.fail(f"{path} differs from its reference copy (scripts/ci/plan/refresh_reference.py writes it):\n{diff[:3000]}")

    def test_no_job_or_step_has_a_property_the_contract_does_not_know(self):
        for path in sorted(FILES):
            doc = load(path)
            for name, job in doc.get("jobs", {}).items():
                self.assertLessEqual(set(job), JOB_KEYS, f"{path}:{name}")
                for step in job.get("steps", []):
                    self.assertLessEqual(set(step), STEP_KEYS, f"{path}:{name}: {step.get('name')}")

    def test_nothing_changes_the_shell_or_forgives_a_failure(self):
        for path in sorted(FILES):
            doc = load(path)
            for node in walk(doc):
                if isinstance(node, dict):
                    self.assertNotIn("shell", node, path)
                    self.assertNotIn("continue-on-error", node, path)
            for scope in [doc] + list(doc.get("jobs", {}).values()):
                run_defaults = ((scope.get("defaults") or {}).get("run") or {}) if isinstance(scope, dict) else {}
                self.assertLessEqual(set(run_defaults), {"working-directory"}, path)

    def test_a_checkout_names_no_ref_but_the_release_gate_s_literal(self):
        for path in sorted(FILES):
            for name, job in load(path).get("jobs", {}).items():
                for step in job.get("steps", []):
                    if str(step.get("uses", "")).startswith("actions/checkout@") and "ref" in (step.get("with") or {}):
                        self.assertEqual(step["with"]["ref"], CHECKOUT_REF.get((path, name)), f"{path}:{name}")


if __name__ == "__main__":
    unittest.main()
