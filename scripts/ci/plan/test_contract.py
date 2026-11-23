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

import copy

from wiring_support import FILES, REFERENCE, ROOT, dump_reference, load, walk, without_pin_values

JOB_KEYS = {"name", "needs", "if", "uses", "runs-on", "timeout-minutes", "steps", "outputs", "defaults", "env", "permissions", "strategy", "concurrency"}
STEP_KEYS = {"name", "id", "uses", "with", "run", "env", "working-directory", "if"}
# The one checkout of another ref: the release gate, with a literal.
CHECKOUT_REF = {(".github/workflows/release.yml", "verify"): "main"}


class Contract(unittest.TestCase):
    def test_the_references_are_exactly_the_workflows(self):
        self.assertEqual(sorted(os.listdir(REFERENCE)), sorted(os.path.basename(p) for p in FILES))

    def test_every_workflow_equals_its_reference_copy(self):
        for path in sorted(FILES):
            ours = without_pin_values(load(path))
            with open(os.path.join(REFERENCE, os.path.basename(path)), encoding="utf-8") as handle:
                theirs = without_pin_values(load(os.path.relpath(handle.name, ROOT)))
            if ours != theirs:
                diff = "\n".join(difflib.unified_diff(dump_reference(theirs).splitlines(), dump_reference(ours).splitlines(), "reference", path, lineterm="", n=2))
                self.fail(f"{path} differs from its reference copy (scripts/ci/plan/refresh_reference.py writes it):\n{diff[:3000]}")

    def test_a_bump_of_a_pin_does_not_need_the_reference_to_be_written_again(self):
        """What Dependabot does: a new commit for an action, a new digest for an image."""
        doc = load(".github/workflows/ci.yml")
        bumped = copy.deepcopy(doc)
        step = bumped["jobs"]["plan"]["steps"][0]
        self.assertRegex(step["uses"], r"^actions/checkout@[0-9a-f]{40}$")
        step["uses"] = "actions/checkout@" + "f" * 40
        self.assertEqual(without_pin_values(bumped), without_pin_values(doc))
        image = load(".github/workflows/ci-debian.yml")
        moved = copy.deepcopy(image)
        moved["env"]["DEBIAN_IMAGE"] = moved["env"]["DEBIAN_IMAGE"].split("@sha256:")[0] + "@sha256:" + "e" * 64
        self.assertNotEqual(moved, image)
        self.assertEqual(without_pin_values(moved), without_pin_values(image))

    def test_what_is_not_the_value_of_a_pin_still_has_to_be_equal(self):
        doc = load(".github/workflows/ci.yml")
        image = load(".github/workflows/ci-debian.yml")

        def changed(base, edit):
            other = copy.deepcopy(base)
            edit(other)
            return without_pin_values(other) != without_pin_values(base)

        def first(d):
            return d["jobs"]["plan"]["steps"][0]

        self.assertTrue(changed(doc, lambda d: first(d).update(uses="actions/other@" + "a" * 40)), "the name of the action")
        self.assertTrue(changed(doc, lambda d: first(d).update(uses="someone/checkout@" + "a" * 40)), "the owner of the action")
        self.assertTrue(changed(doc, lambda d: first(d).update(uses="actions/checkout")), "the pin taken away")
        self.assertTrue(changed(doc, lambda d: first(d).update(uses="actions/checkout@v7")), "a tag for a commit")
        self.assertTrue(changed(doc, lambda d: first(d).update(uses="actions/checkout@" + "a" * 39)), "a short commit")
        self.assertTrue(changed(doc, lambda d: first(d).update(uses="actions/checkout@" + "a" * 41)), "a long commit")
        self.assertTrue(changed(doc, lambda d: first(d).update(uses="actions/checkout@" + "A" * 40)), "an upper case commit")
        self.assertTrue(changed(doc, lambda d: first(d).update(uses="./actions/checkout")), "a local action")
        self.assertTrue(changed(image, lambda d: d["env"].update(DEBIAN_IMAGE="docker.io/library/ubuntu:trixie@sha256:" + "e" * 64)), "the repository of the image")
        self.assertTrue(changed(image, lambda d: d["env"].update(DEBIAN_IMAGE="docker.io/library/debian:forky@sha256:" + "e" * 64)), "the tag of the image")
        self.assertTrue(changed(image, lambda d: d["env"].update(DEBIAN_IMAGE="docker.io/library/debian:trixie")), "the digest taken away")
        self.assertTrue(changed(image, lambda d: d["env"].update(DEBIAN_IMAGE="docker.io/library/debian:trixie@sha256:" + "e" * 63)), "a short digest")
        self.assertTrue(changed(doc, lambda d: d["jobs"]["unit"]["steps"][-1].update(run="echo 'scripts/test/coverage.sh'")), "a command")

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
