#!/usr/bin/env python3
"""Tests of which runs a newer run may cancel.

A newer run of the same pull request supersedes the one in flight, and only on
`pull_request`. A run on a push, a schedule, a dispatch or a tag is never cancelled,
and neither is a security result (the audit, CodeQL, the sign-off check) or the
release. Run from the repository root, with PyYAML (hash-pinned in requirements.txt):

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v
"""

import unittest

from wiring_support import enumerate_files, load, triggers

PULL_REQUEST_ONLY = "${{ github.event_name == 'pull_request' }}"

# The only workflows whose runs may be cancelled, and only by a newer run of the same pull request.
CANCELLABLE = {
    ".github/workflows/ci.yml": "${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    ".github/workflows/folder-limit.yml": "${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}",
    ".github/workflows/main-guard.yml": "${{ github.workflow }}-${{ github.event.pull_request.number }}",
}
EVENTS = ("pull_request", "push", "schedule", "workflow_dispatch", "merge_group", "workflow_call", "release")


def workflows():
    return sorted(p for p in enumerate_files() if p.startswith(".github/workflows/"))


def cancels(setting, event):
    """What `cancel-in-progress` means for a run of this event; only the two known forms are read."""
    if setting is False:
        return False
    assert setting == PULL_REQUEST_ONLY, setting
    return event == "pull_request"


class Cancellation(unittest.TestCase):
    def test_every_workflow_that_runs_by_itself_says_what_may_cancel_it(self):
        for path in workflows():
            doc = load(path)
            if set(triggers(doc)) == {"workflow_call"}:
                self.assertNotIn("concurrency", doc, f"{path} is called; the caller's group decides")
                continue
            self.assertIn("concurrency", doc, path)
            self.assertIn(doc["concurrency"].get("cancel-in-progress"), (False, PULL_REQUEST_ONLY), path)

    def test_the_list_of_workflows_that_a_newer_run_cancels_is_closed(self):
        found = {p for p in workflows() if "concurrency" in load(p) and load(p)["concurrency"]["cancel-in-progress"] is not False}
        self.assertEqual(found, set(CANCELLABLE))
        for path, group in CANCELLABLE.items():
            self.assertEqual(load(path)["concurrency"]["group"], group, path)

    def test_a_newer_run_cancels_only_on_a_pull_request(self):
        for path in workflows():
            doc = load(path)
            if "concurrency" not in doc:
                continue
            for event in EVENTS:
                expected = path in CANCELLABLE and event == "pull_request"
                self.assertEqual(cancels(doc["concurrency"]["cancel-in-progress"], event), expected, (path, event))

    def test_a_cancelling_workflow_has_no_schedule_and_a_group_a_push_cannot_share_with_a_pull_request(self):
        for path in CANCELLABLE:
            doc = load(path)
            self.assertNotIn("schedule", triggers(doc), path)
            self.assertNotIn("workflow_dispatch", triggers(doc), path)
            group = doc["concurrency"]["group"]
            self.assertIn("github.event.pull_request.number", group, path)
            # Without a pull request number the group falls back to the ref, which a pull request's number never equals.
            if "||" in group:
                self.assertTrue(group.endswith("|| github.ref }}"), path)

    def test_the_security_results_and_the_release_are_never_cancelled(self):
        for name in ("audit", "codeql", "dco", "release", "pins", "dependabot-watch"):
            doc = load(f".github/workflows/{name}.yml")
            self.assertIs(doc["concurrency"]["cancel-in-progress"], False, name)
            for event in EVENTS:
                self.assertFalse(cancels(doc["concurrency"]["cancel-in-progress"], event), (name, event))


if __name__ == "__main__":
    unittest.main()
