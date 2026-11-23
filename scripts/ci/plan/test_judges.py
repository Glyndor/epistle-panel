#!/usr/bin/env python3
"""Tests of what judges the whole tree, of the weekly audit, and of the steps that
run the script of the base commit.

Run from the repository root, with PyYAML (hash-pinned in requirements.txt):

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

The steps run in a throwaway repository with a script on each side, and must run
the base's.
"""

import json
import os
import re
import subprocess
import tempfile
import unittest

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
    SUITES,
    StrictLoader,
    THIRD,
    _mapping,
    enumerate_files,
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

    def test_the_dependency_audit_is_not_conditioned_by_paths(self):
        doc = load(".github/workflows/audit.yml")
        self.assertEqual(
            triggers(doc),
            {
                "pull_request": {"branches": ["develop", "main"]},
                "push": {"branches": ["develop", "main"]},
                "schedule": [{"cron": "23 6 * * 1"}],
                "workflow_dispatch": None,
            },
        )
        job = doc["jobs"]["audit"]
        self.assertEqual(set(job), {"name", "runs-on", "timeout-minutes", "steps"})
        self.assertEqual(job["name"], AUDIT_NAME)

    def test_a_security_result_is_never_cancelled_by_a_newer_push(self):
        """The audit, CodeQL and the sign-off check keep running when a branch moves on."""
        for name in ("audit.yml", "codeql.yml", "dco.yml"):
            doc = load(f".github/workflows/{name}")
            self.assertIs(doc["concurrency"]["cancel-in-progress"], False, name)
        self.assertIs(load(".github/workflows/codeql.yml")["concurrency"]["cancel-in-progress"], False)

    def test_the_main_guard_asks_for_the_develop_of_this_repository(self):
        job = load(".github/workflows/main-guard.yml")["jobs"]["develop-only"]
        step = step_named(job, "Require develop of this repository as source branch")
        self.assertEqual(step["env"], {"HEAD_REF": "${{ github.head_ref }}", "HEAD_REPO": "${{ github.event.pull_request.head.repo.full_name }}", "REPO": "${{ github.repository }}"})
        cases = (
            ("develop", "Glyndor/epistle-panel", "Glyndor/epistle-panel", True),
            ("develop", "someone/epistle-panel", "Glyndor/epistle-panel", False),
            ("develop", "", "Glyndor/epistle-panel", False),
            ("feature", "Glyndor/epistle-panel", "Glyndor/epistle-panel", False),
            ("Develop", "Glyndor/epistle-panel", "Glyndor/epistle-panel", False),
        )
        for head, repo, mine, ok in cases:
            done = subprocess.run(["bash", "-c", step["run"]], env=dict(os.environ, HEAD_REF=head, HEAD_REPO=repo, REPO=mine), capture_output=True, text=True)
            self.assertEqual(done.returncode == 0, ok, (head, repo, done.stdout))

    def test_the_action_pins_check_is_a_job_of_the_gate_and_is_looked_at_again_every_week(self):
        """The one that stands in the way of a merge is `action pins` in ci.yml; this one is the clock."""
        doc = load(".github/workflows/pins.yml")
        self.assertEqual(triggers(doc), {"schedule": [{"cron": "29 6 * * 1"}], "workflow_dispatch": None})
        self.assertEqual(doc["permissions"], {})
        job = doc["jobs"]["pins"]
        self.assertEqual(job["permissions"], {"contents": "read"})
        self.assertEqual(set(job) & {"if", "needs", "continue-on-error"}, set())
        step = step_named(job, "Every reference is the commit or the digest of its release")
        self.assertIn("check.py --remote --weekly --report", step["run"])
        ci = load(".github/workflows/ci.yml")["jobs"]
        self.assertIn("action-pins", ci["gate"]["needs"])
        remote = step_named(ci["action-pins"], "Every reference is fixed to the commit or the digest of its release")["run"]
        self.assertIn('args=(--remote --base HEAD^1)', remote, "a pull request asks about what it changes")
        self.assertIn('"$RUNNER_TEMP/pins-venv/bin/python" -I "$script" "${args[@]}"', remote)
        self.assertIn("git show HEAD^1:scripts/ci/plan/requirements.txt", step_named(ci["action-pins"], "The YAML reader of the check")["run"])

    def test_the_job_that_writes_the_issue_has_issues_write_and_nothing_else_and_reads_a_report_as_data(self):
        report = load(".github/workflows/pins.yml")["jobs"]["report"]
        self.assertEqual(report["permissions"], {"issues": "write"})
        self.assertEqual(report["needs"], "pins")
        for step in report["steps"]:
            self.assertFalse(str(step.get("uses", "")).startswith("actions/checkout@"), "it checks out no code")
        self.assertEqual([s.get("uses", "").split("@")[0] for s in report["steps"]], ["actions/download-artifact", ""])

    def drift(self, entries, existing=""):
        """The issue step of the Monday run, against a stand-in `gh` and a report; returns status, calls."""
        step = step_named(load(".github/workflows/pins.yml")["jobs"]["report"], "Open the issue, or update the one that is open")
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "drift"))
            if entries is not None:
                with open(os.path.join(tmp, "drift", "drift.json"), "w") as handle:
                    handle.write(entries)
            bindir = os.path.join(tmp, "bin")
            os.makedirs(bindir)
            gh = os.path.join(bindir, "gh")
            with open(gh, "w") as handle:
                handle.write(f'#!/bin/sh\necho "$@" >> {tmp}/calls\nif [ "$1 $2" = "issue list" ]; then echo "{existing}"; fi\n')
            os.chmod(gh, 0o755)
            done = subprocess.run(["bash", "-c", step["run"]], env=dict(os.environ, RUNNER_TEMP=tmp, REPO="o/r", GH_TOKEN="x", PATH=f"{bindir}:{os.environ['PATH']}"), capture_output=True, text=True)
            calls = ""
            if os.path.exists(os.path.join(tmp, "calls")):
                with open(os.path.join(tmp, "calls")) as handle:
                    calls = handle.read()
            return done, calls

    MOVED = json.dumps([{"repository": "docker.io/library/debian", "tag": "trixie", "pinned": "sha256:" + "a" * 64, "current": "sha256:" + "b" * 64}])

    def test_an_issue_is_opened_for_an_image_that_moved(self):
        done, calls = self.drift(self.MOVED)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("issue create", calls)
        self.assertNotIn("issue edit", calls)
        self.assertIn("sha256:" + "b" * 64, calls)

    def test_the_issue_that_is_open_is_updated_and_not_duplicated(self):
        done, calls = self.drift(self.MOVED, existing="42")
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("issue edit 42", calls)
        self.assertNotIn("issue create", calls)

    def test_no_issue_when_nothing_moved_or_there_is_no_report(self):
        for entries in ("[]", None):
            done, calls = self.drift(entries)
            self.assertEqual(done.returncode, 0, done.stderr)
            self.assertEqual(calls, "")

    def test_an_entry_of_another_shape_is_refused_before_anything_is_written(self):
        bad = json.loads(self.MOVED)
        for field, value in (("repository", "x; rm -rf /"), ("tag", "a b"), ("pinned", "sha256:abc"), ("current", "`touch x`")):
            entry = dict(bad[0], **{field: value})
            done, calls = self.drift(json.dumps([entry]))
            self.assertNotEqual(done.returncode, 0, field)
            self.assertNotIn("issue create", calls, field)
        done, calls = self.drift('{"not": "a list"}')
        self.assertNotEqual(done.returncode, 0)
        self.assertEqual(calls, "")

    def test_a_scheduled_workflow_brings_no_other_tree(self):
        """The run of a schedule holds the privileges of the default branch.

        One checkout, the event's: no `ref`, no `path`, no second checkout, no local
        action, and no step that installs. What another branch holds is read as data.
        """
        scheduled = [path for path in sorted(FILES) if "schedule" in triggers(load(path))]
        self.assertIn(".github/workflows/audit.yml", scheduled)
        for path in scheduled:
            for name, job in load(path)["jobs"].items():
                steps = job.get("steps", [])
                checkouts = [s for s in steps if str(s.get("uses", "")).startswith("actions/checkout@")]
                self.assertLessEqual(len(checkouts), 1, f"{path}:{name} checks out twice")
                for step in checkouts:
                    self.assertEqual(set(step.get("with") or {}) - {"fetch-depth", "persist-credentials"}, set(), f"{path}:{name} brings a ref or a path")
                    self.assertIs(step["with"]["persist-credentials"], False, f"{path}:{name}")
                for step in steps:
                    self.assertFalse(str(step.get("uses", "")).startswith("./"), f"{path}:{name} runs an action of the tree")
                    self.assertNotRegex(str(step.get("run", "")), r"\bbun (install|i|add|ci)\b|\bnpm (ci|install)\b", f"{path}:{name} installs")

    def test_the_audit_reads_the_other_branches_as_two_files_and_installs_nothing(self):
        job = load(".github/workflows/audit.yml")["jobs"]["audit"]
        step = step_named(job, "Advisories in the lockfiles")
        self.assertEqual(step["env"], {"EVENT": "${{ github.event_name }}", "BRANCHES": "develop main"})
        run = step["run"]
        for piece in (
            'git show "origin/${branch}:internal/${file}" >"$dir/$file"',
            "for file in package.json bun.lock; do",
            'dir="$(mktemp -d "$RUNNER_TEMP/audited.XXXXXX")"',
            'if [ ! -s "$dir/$file" ]; then',
            '(cd "$dir" && bun audit) || failed=1',
            'exit "$failed"',
        ):
            self.assertIn(piece, run)
        self.assertEqual(run.count("bun audit"), 2)
        checkout = job["steps"][0]
        self.assertEqual(checkout["with"], {"fetch-depth": 0, "persist-credentials": False})
        install = job["steps"][1]
        self.assertEqual(install["run"], "bash scripts/ci/bun/install.sh", "Bun comes from the installer of the event's own tree, with no cache")
        self.assertNotIn("uses", install)
        self.assertEqual(len(job["steps"]), 3)

    def test_the_audit_step_audits_each_branch_in_an_empty_folder_outside_the_workspace(self):
        job = load(".github/workflows/audit.yml")["jobs"]["audit"]
        run = step_named(job, "Advisories in the lockfiles")["run"]
        with tempfile.TemporaryDirectory() as tmp:
            repo = os.path.join(tmp, "repo")
            fixture = Fixture(tmp, {"internal/package.json": "{}\n", "internal/bun.lock": "lock\n", "internal/postinstall.sh": "bad"}, {"internal/other": "x"})
            fixture.git("branch", "develop")
            fixture.git("update-ref", "refs/remotes/origin/develop", "HEAD")
            fixture.git("update-ref", "refs/remotes/origin/main", "HEAD")
            bindir = os.path.join(tmp, "bin")
            os.makedirs(bindir)
            stub = os.path.join(bindir, "bun")
            with open(stub, "w") as handle:
                handle.write('#!/bin/sh\nprintf "%s|%s\\n" "$PWD" "$(ls | tr "\\n" " ")" >> "$AUDIT_LOG"\n')
            os.chmod(stub, 0o755)
            env = {"EVENT": "schedule", "BRANCHES": "develop main", "RUNNER_TEMP": tmp, "AUDIT_LOG": os.path.join(tmp, "log"), "PATH": f"{bindir}:{os.environ['PATH']}"}
            done = fixture.run(run, **env)
            self.assertEqual(done.returncode, 0, done.stderr)
            with open(env["AUDIT_LOG"]) as handle:
                lines = handle.read().splitlines()
            self.assertEqual(len(lines), 2)
            for line in lines:
                where, listing = line.split("|")
                self.assertTrue(where.startswith(tmp + "/audited."), where)
                self.assertFalse(where.startswith(repo), "inside the workspace")
                self.assertEqual(listing.split(), ["bun.lock", "package.json"], "only the two lockfile files")
            # a branch that does not exist stops the step
            missing = fixture.run(run, **dict(env, BRANCHES="develop nowhere", AUDIT_LOG=os.path.join(tmp, "log2")))
            self.assertNotEqual(missing.returncode, 0)
            # an empty file stops it too
            fixture.write({"internal/bun.lock": ""})
            fixture.git("add", "-A")
            fixture.git("commit", "-q", "-m", "empty")
            fixture.git("update-ref", "refs/remotes/origin/develop", "HEAD")
            empty = fixture.run(run, **dict(env, AUDIT_LOG=os.path.join(tmp, "log3")))
            self.assertNotEqual(empty.returncode, 0)
            self.assertIn("is empty", empty.stdout + empty.stderr)

    def test_a_job_that_checks_out_another_ref_restores_and_saves_no_cache(self):
        """A job that brings code from another ref installs clean.

        A cache restored or saved after that is one another branch can poison: no
        cache action, no cache input of a setup action, no setup-bun that caches,
        and credentials left out of the checkout. (A scheduled job brings no other
        tree at all; see test_a_scheduled_workflow_brings_no_other_tree.)
        """
        found = []
        for path in sorted(FILES):
            for name, job in load(path).get("jobs", {}).items():
                steps = job.get("steps", [])
                checkouts = [s for s in steps if str(s.get("uses", "")).startswith("actions/checkout@") and "ref" in (s.get("with") or {})]
                if not checkouts:
                    continue
                found.append((os.path.basename(path), name))
                for step in checkouts:
                    self.assertIs(step["with"].get("persist-credentials"), False, f"{path}:{name}")
                for step in steps:
                    uses, given = str(step.get("uses", "")), step.get("with") or {}
                    self.assertFalse(uses.startswith("actions/cache"), f"{path}:{name} uses a cache action")
                    for key, value in given.items():
                        if key.startswith("cache") and key != "no-cache":
                            self.assertFalse(value, f"{path}:{name} sets {key}")
                    if uses.startswith("oven-sh/setup-bun@"):
                        self.assertIs(given.get("no-cache"), True, f"{path}:{name} lets setup-bun cache")
        self.assertIn(("release.yml", "verify"), found, "the release gate no longer checks out another ref, or the test cannot see it")

    def test_the_line_limit_is_on_the_whole_tree_and_outside_the_plan(self):
        self.assertEqual(ALWAYS, ["line-limit", "commit-checks"])
        self.assertNotIn("line-limit", SUITES)
        self.assertNotIn("commit-checks", SUITES)

    def test_no_comment_sends_the_reader_outside_the_repository(self):
        """A comment names files of this repository, not a report, a review or a standard held elsewhere."""
        # The words are written in pieces so that this file does not match itself:
        # no file is left out of the search, this one included.
        words = ["standards" + "/", "ai" + "-context", "audit" + " round", "review" + " round", r"\bsession" + " of\\b"]
        bad = re.compile("|".join(words), re.I)
        for path in tracked():
            if path.startswith(".github/") or path.startswith("scripts/ci/"):
                with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
                    self.assertIsNone(bad.search(handle.read()), path)


class Release(unittest.TestCase):
    """Who holds the authority to attest, push and publish in release.yml."""

    READ = {"contents": "read"}
    PERMISSIONS = {
        "verify": READ,
        "build-deb": READ,
        "attest-deb": {"contents": "read", "id-token": "write", "attestations": "write"},
        "sbom": READ,
        "sign": READ,
        "rehearse-sign": READ,
        "release-check": READ,
        "publish": {"contents": "write"},
        "image-build": READ,
        "image-push": {"contents": "read", "packages": "write"},
        "rehearse-manifest": READ,
        "image-manifest": {"contents": "read", "packages": "write", "id-token": "write", "attestations": "write"},
        "promote-images": {"contents": "read", "packages": "write"},
    }

    @classmethod
    def setUpClass(cls):
        cls.doc = load(".github/workflows/release.yml")
        cls.jobs = cls.doc["jobs"]

    def test_nobody_holds_authority_by_default_and_every_job_names_its_own(self):
        self.assertEqual(self.doc["permissions"], {})
        self.assertEqual({name: job.get("permissions") for name, job in self.jobs.items()}, self.PERMISSIONS)

    def test_what_builds_or_installs_has_contents_read_and_nothing_else(self):
        for name in ("verify", "build-deb", "sbom", "sign", "rehearse-sign", "release-check", "image-build", "rehearse-manifest"):
            self.assertEqual(self.jobs[name]["permissions"], self.READ, name)

    def test_a_rehearsal_never_reaches_a_job_with_authority_to_publish(self):
        for name, job in self.jobs.items():
            if job["permissions"] != self.READ:
                self.assertIn("!inputs.dry-run", job["if"], f"{name} can run in a rehearsal")

    def test_the_jobs_that_attest_and_push_check_out_no_code_and_run_no_script_of_the_repository(self):
        for name in ("attest-deb", "image-push"):
            for step in self.jobs[name]["steps"]:
                self.assertFalse(str(step.get("uses", "")).startswith("actions/checkout@"), f"{name} checks out code")
                self.assertNotRegex(str(step.get("run", "")), r"scripts/|python|\bbun\b", f"{name}: {step.get('name')}")

    def test_what_arrives_is_the_one_file_expected_and_the_package_is_attested_from_there(self):
        step = step_named(self.jobs["attest-deb"], "Check that the package is the one file expected")
        self.assertIn('want="epistle-panel_${TAG#v}_all.deb"', step["run"])
        self.assertIn('[ "$found" != "$want" ]', step["run"])
        self.assertEqual(step_named(self.jobs["attest-deb"], "Attest build provenance")["with"], {"subject-path": "${{ runner.temp }}/attest/epistle-panel_*_all.deb"})
        self.assertIn("attest-deb", self.jobs["release-check"]["needs"])
        self.assertIn("release-check", self.jobs["publish"]["needs"])
        self.assertIn("image-push", self.jobs["image-manifest"]["needs"])


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
        job = load(".github/workflows/ci.yml")["jobs"]["action-pins"]
        step = step_named(job, "Every reference is fixed to the commit or the digest of its release")
        with tempfile.TemporaryDirectory() as tmp:
            fixture = Fixture(tmp, {"scripts/ci/pins/check.py": "base\n"}, {"scripts/ci/pins/check.py": "pr\n"})
            python = os.path.join(tmp, "pins-venv", "bin", "python")
            os.makedirs(os.path.dirname(python))
            with open(python, "w") as handle:
                handle.write(f'#!/bin/sh\ncat "$2" > {tmp}/who\n')
            os.chmod(python, 0o755)
            done = fixture.run(step["run"], EVENT="pull_request", RUNNER_TEMP=tmp)
            self.assertEqual(done.returncode, 0, done.stderr)
            with open(os.path.join(tmp, "who")) as handle:
                self.assertEqual(handle.read().strip(), "base")
            # the change that introduces the script has no base copy to run
            first = Fixture(os.path.join(tmp, "first"), None, {"scripts/ci/pins/check.py": "pr\n"}) if os.makedirs(os.path.join(tmp, "first")) is None else None
            done = first.run(step["run"], EVENT="pull_request", RUNNER_TEMP=tmp)
            self.assertEqual(done.returncode, 0, done.stderr)
            with open(os.path.join(tmp, "who")) as handle:
                self.assertEqual(handle.read().strip(), "pr")

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
