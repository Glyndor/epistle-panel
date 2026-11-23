#!/usr/bin/env python3
"""Tests of scripts/ci/plan/plan.py and of the map it reads.

Run from the repository root:

	python3 -I -m unittest discover -s scripts/ci/plan -p 'test_*.py' -v

Three kinds of test. The cases say, for a path, which suites it selects, and
every suite has a case where it runs and one where it does not, so a suite that
runs for a change of nothing of its own fails here, and so does one that does
not run for a change of its own. The integrity tests read the real tree: every
tracked file is read by a suite or ignored on purpose, and no pattern of the map
points at nothing. The workflow tests read ci.yml and hold its jobs, the
conditions of its jobs and the `needs` of its gate to the map.
"""

import glob
import importlib.util
import os
import re
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
MAP = os.path.join(HERE, "map.toml")
CI = os.path.join(ROOT, ".github", "workflows", "ci.yml")

spec = importlib.util.spec_from_file_location("plan", os.path.join(HERE, "plan.py"))
plan = importlib.util.module_from_spec(spec)
spec.loader.exec_module(plan)

DATA = plan.load_map(MAP)
SUITES = list(DATA["suites"])

APP = {"lint", "unit", "randomized"}
SHIPPED = {"e2e", "container"}

# path -> the suites it selects, and nothing else.
CASES = {
    "README.md": set(),
    "docs/maintainers/preferences.md": set(),
    "docs/operators/x.md": set(),
    "LICENSE": set(),
    ".gitignore": set(),
    ".editorconfig": set(),
    ".github/dependabot.yml": set(),
    ".github/folder-limit-exceptions.txt": set(),
    "scripts/folder-limit/folder-limit.sh": {"line-limit"},
    "internal/src/app/page.tsx": APP | SHIPPED | {"line-limit"},
    "internal/src/features/mail/index.test.ts": APP | {"line-limit"},
    "internal/src/features/mail/index.test.tsx": APP | {"line-limit"},
    "internal/src/test/setup/index.ts": APP | {"line-limit"},
    "internal/src/lib/x/test-support/fake.ts": APP | {"line-limit"},
    "internal/src/messages/en.json": APP | SHIPPED,
    "internal/biome.json": {"lint"},
    "internal/components.json": {"lint"},
    "internal/.gitignore": set(),
    "internal/bunfig.toml": APP,
    "internal/package.json": APP | SHIPPED | {"debian"},
    "internal/bun.lock": APP | SHIPPED,
    "internal/next.config.ts": APP | SHIPPED | {"line-limit"},
    "scripts/test/coverage.sh": {"unit", "randomized", "line-limit"},
    "scripts/e2e/run.sh": {"e2e", "line-limit"},
    "scripts/e2e/scenarios/auth/login.ts": {"e2e", "line-limit"},
    "scripts/headers/verify.sh": {"e2e", "line-limit"},
    "Containerfile": {"container", "bun-version"},
    ".containerignore": {"container"},
    "scripts/consistency/check-base-indexes.sh": {"container", "bun-version", "line-limit"},
    "scripts/consistency/check-bun-version.sh": {"bun-version", "line-limit"},
    "debian/control": {"debian"},
    "debian/changelog": {"debian"},
    "scripts/debian/build.sh": {"debian", "line-limit"},
    "scripts/release/version/check-changelog.sh": {"debian", "release-scripts", "line-limit"},
    "scripts/release/sign/sign.py": {"release-scripts", "line-limit"},
    "scripts/release/lib/assertions.sh": {"release-scripts", "bun-version", "line-limit"},
    ".github/workflows/dco.yml": {"actionlint", "bun-version", "ci-scripts"},
    ".github/workflows/release.yml": {"actionlint", "bun-version", "ci-scripts"},
    ".github/workflows/ci-e2e.yml": {"actionlint", "bun-version", "ci-scripts"},
    "scripts/ci/dco/check.sh": {"ci-scripts", "line-limit"},
    "scripts/ci/freshness/check.test.sh": {"ci-scripts", "line-limit"},
    "scripts/ci/dependabot_security_watch.py": {"ci-scripts", "line-limit"},
}

# A change to the machinery runs everything.
MACHINERY = [
    ".github/workflows/ci.yml",
    "scripts/ci/plan/plan.py",
    "scripts/ci/plan/map.toml",
    "scripts/ci/plan/gate.py",
    "scripts/ci/plan/test_plan.py",
]


def run_plan(files, event="pull_request"):
    """plan() over a list of paths, as {suite: bool} and the unclaimed paths."""
    return plan.plan(DATA, event, files)


class Globs(unittest.TestCase):
    def test_star_stops_at_a_slash(self):
        self.assertTrue(plan.matches(["a/*.ts"], "a/b.ts"))
        self.assertFalse(plan.matches(["a/*.ts"], "a/b/c.ts"))

    def test_double_star_crosses_folders_and_may_match_none(self):
        self.assertTrue(plan.matches(["**/*.ts"], "a.ts"))
        self.assertTrue(plan.matches(["**/*.ts"], "a/b/c.ts"))
        self.assertTrue(plan.matches(["a/**"], "a/b/c.ts"))
        self.assertFalse(plan.matches(["a/**"], "b/a/c.ts"))

    def test_a_dot_is_a_dot(self):
        self.assertFalse(plan.matches(["a.ts"], "aXts"))
        self.assertFalse(plan.matches(["**/*.ts"], "a.tsx"))

    def test_a_pattern_must_match_the_whole_path(self):
        self.assertFalse(plan.matches(["internal/**"], "x/internal/a"))
        self.assertFalse(plan.matches(["Containerfile"], "Containerfile.bak"))

    def test_bad_patterns_are_refused(self):
        for bad in ["", "/etc/passwd", "./a", "a/../b", "a[b]", "a{b}", "!a", "a\\b"]:
            with self.assertRaises(plan.BadPattern, msg=bad):
                plan.compile_pattern(bad)


class Selection(unittest.TestCase):
    def test_every_case(self):
        for path, expected in CASES.items():
            verdict, unclaimed = run_plan([path])
            self.assertEqual(unclaimed, [], path)
            self.assertEqual({s for s, on in verdict.items() if on}, expected, path)

    def test_every_suite_has_a_case_where_it_runs_and_one_where_it_does_not(self):
        for suite in SUITES:
            self.assertTrue(any(suite in want for want in CASES.values()), f"{suite} never runs in a case")
            self.assertTrue(any(suite not in want for want in CASES.values()), f"{suite} runs in every case")

    def test_the_cases_name_only_suites_of_the_map(self):
        for want in CASES.values():
            self.assertLessEqual(want, set(SUITES))

    def test_a_change_of_two_files_is_the_union(self):
        verdict, _ = run_plan(["README.md", "debian/control"])
        self.assertEqual({s for s, on in verdict.items() if on}, {"debian"})

    def test_a_rename_counts_both_paths(self):
        verdict, _ = run_plan(["internal/src/a.tsx", "docs/a.md"])
        self.assertTrue(verdict["e2e"])

    def test_the_machinery_runs_every_suite(self):
        for path in MACHINERY:
            verdict, unclaimed = run_plan(["README.md", path])
            self.assertTrue(all(verdict.values()), path)
            self.assertEqual(unclaimed, [])

    def test_an_unreadable_or_empty_diff_runs_every_suite(self):
        verdict, unclaimed = run_plan(None)
        self.assertTrue(all(verdict.values()))
        self.assertEqual(unclaimed, [])

    def test_a_push_runs_the_suites_that_describe_the_branch(self):
        verdict, _ = run_plan(None, "push")
        self.assertEqual({s for s, on in verdict.items() if on}, {"lint", "unit"})

    def test_any_other_event_runs_every_suite(self):
        for event in ("workflow_dispatch", "schedule", "merge_group", ""):
            verdict, _ = run_plan(["README.md"], event)
            self.assertTrue(all(verdict.values()), event)

    def test_a_path_nobody_claims_runs_everything_and_is_reported(self):
        verdict, unclaimed = run_plan(["README.md", "newdir/data.xyz"])
        self.assertTrue(all(verdict.values()))
        self.assertEqual(unclaimed, ["newdir/data.xyz"])

    def test_an_exclude_removes_a_path_from_its_suite_only(self):
        verdict, _ = run_plan(["internal/src/x/index.test.ts"])
        self.assertTrue(verdict["unit"])
        self.assertFalse(verdict["e2e"])


class Command(unittest.TestCase):
    """The program, the way the workflow runs it."""

    def run_cli(self, paths, event="pull_request"):
        with tempfile.NamedTemporaryFile("w", suffix=".txt", delete=False) as handle:
            handle.write("\n".join(paths) + "\n")
        try:
            return subprocess.run(
                [sys.executable, "-I", os.path.join(HERE, "plan.py"), "--map", MAP, "--event", event, "--files-from", handle.name],
                capture_output=True,
                text=True,
            )
        finally:
            os.unlink(handle.name)

    def test_stdout_is_only_suite_lines(self):
        done = self.run_cli(["README.md"])
        self.assertEqual(done.returncode, 0)
        lines = done.stdout.splitlines()
        self.assertEqual([line.split("=")[0] for line in lines], SUITES)
        for line in lines:
            self.assertRegex(line, r"^[a-z0-9-]+=(true|false)$")

    def test_an_unclaimed_path_fails_and_still_prints_every_suite_on(self):
        done = self.run_cli(["newdir/data.xyz"])
        self.assertEqual(done.returncode, 1)
        self.assertEqual(done.stdout.count("=true"), len(SUITES))
        self.assertIn("newdir/data.xyz", done.stderr)

    def test_a_broken_map_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            bad = os.path.join(tmp, "map.toml")
            with open(bad, "w") as handle:
                handle.write('[suites.Upper]\ninclude = ["a"]\n')
            done = subprocess.run([sys.executable, "-I", os.path.join(HERE, "plan.py"), "--map", bad], capture_output=True, text=True)
            self.assertNotEqual(done.returncode, 0)


def tracked():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True).stdout
    return [p.decode() for p in out.split(b"\0") if p]


@unittest.skipUnless(os.path.isdir(os.path.join(ROOT, ".git")) or os.path.isfile(os.path.join(ROOT, ".git")), "needs a git checkout")
class Integrity(unittest.TestCase):
    """The map against the tree it describes."""

    @classmethod
    def setUpClass(cls):
        cls.files = tracked()

    def test_every_tracked_file_is_read_by_a_suite_or_ignored_on_purpose(self):
        ignore = DATA["ignore"]["paths"]
        orphans = [
            f
            for f in self.files
            if not plan.matches(DATA.get("machinery", []), f)
            and not plan.matches(ignore, f)
            and not any(plan.selects(s, f) for s in DATA["suites"].values())
        ]
        self.assertEqual(orphans, [], "files no suite reads and the map does not ignore")

    def test_no_suite_points_at_nothing(self):
        for name, suite in DATA["suites"].items():
            self.assertTrue([f for f in self.files if plan.selects(suite, f)], f"suite {name} reads no tracked file")

    def test_no_pattern_of_the_map_points_at_nothing(self):
        patterns = list(DATA.get("machinery", [])) + list(DATA["ignore"]["paths"])
        for name, suite in DATA["suites"].items():
            patterns += suite["include"]
        for pattern in patterns:
            self.assertTrue(any(plan.matches([pattern], f) for f in self.files), f"{pattern} matches no tracked file")

    def test_line_limit_reads_every_extension_its_script_reads(self):
        with open(os.path.join(ROOT, "scripts", "ci", "line-limit", "check.sh"), encoding="utf-8") as handle:
            exts = set(re.search(r'EXTS="\$\{EXTS:-([^}]*)\}"', handle.read()).group(1).split())
        suite = DATA["suites"]["line-limit"]
        for f in self.files:
            ext = f.rsplit(".", 1)[-1] if "." in os.path.basename(f) else ""
            if ext in exts:
                self.assertTrue(plan.selects(suite, f), f"{f} is read by the line limit and not by its suite")

    def test_every_ignore_pattern_covers_a_file_nobody_else_reads(self):
        """An ignore that only repeats what a suite reads is a pattern to delete."""
        for pattern in DATA["ignore"]["paths"]:
            alone = [
                f
                for f in self.files
                if plan.matches([pattern], f) and not any(plan.selects(s, f) for s in DATA["suites"].values())
            ]
            self.assertTrue(alone, f"{pattern} ignores nothing a suite would not read")


def jobs_of(text):
    """{job id: its block of text} for the top-level jobs of a workflow."""
    body = text.split("\njobs:\n", 1)[1]
    blocks = re.split(r"\n(?=  [a-z0-9-]+:\n)", "\n" + body)
    out = {}
    for block in blocks:
        m = re.match(r"\n?  ([a-z0-9-]+):\n", block + "\n")
        if m:
            out[m.group(1)] = block
    return out


def permissions_of(block, indent):
    """The text of a `permissions:` block at an indent, or None if there is none.

    A one-line value (`write-all`, `{}`) comes back as it is written.
    """
    pad = " " * indent
    m = re.search(rf"(?m)^{pad}permissions:[ \t]*(\S.*)?$", block)
    if not m:
        return None
    if m.group(1):
        return m.group(1).strip()
    lines = []
    for line in block[m.end() :].lstrip("\n").splitlines():
        if line.startswith(pad + "  ") and line.strip():
            lines.append(line.strip())
        else:
            break
    return "\n".join(lines)


def grants_actions_write(perms):
    return perms is not None and (perms.strip() == "write-all" or re.search(r"(?m)^actions:\s*write\s*$", perms) is not None)


CUT_STEPS = """    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 2
          persist-credentials: false

      - name: Cancel the other runs of this pull request commit
        env:
          GH_TOKEN: ${{ github.token }}
          REPO: ${{ github.repository }}
          SHA: ${{ github.event.pull_request.head.sha }}
          BRANCH: ${{ github.event.pull_request.head.ref }}
          BASE_SHA: ${{ github.event.pull_request.base.sha }}
          SELF: ${{ github.run_id }}
        run: |
          set -euo pipefail
          if ! git cat-file -e "${BASE_SHA}:scripts/ci/cancel/others.sh" 2>/dev/null; then
            echo "::notice::the base commit has no scripts/ci/cancel/others.sh; nothing was cancelled"
            exit 0
          fi
          git show "${BASE_SHA}:scripts/ci/cancel/others.sh" >"$RUNNER_TEMP/others.sh"
          bash "$RUNNER_TEMP/others.sh"
"""


def run_text(block):
    """The text of every `run:` of a workflow or a job, as one string."""
    out = []
    lines = block.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)(?:- )?run:\s*(.*)$", line)
        if not m:
            continue
        indent = len(m.group(1))
        if m.group(2) and m.group(2) not in ("|", ">", "|-", ">-"):
            out.append(m.group(2))
            continue
        for follower in lines[i + 1 :]:
            if follower.strip() and len(follower) - len(follower.lstrip()) <= indent:
                break
            out.append(follower)
    return "\n".join(out)


def needs_of(block):
    """The jobs a job waits for, from `needs: [a, b]` or from a list."""
    m = re.search(r"\n    needs: \[([^\]]*)\]", block)
    if m:
        return {n.strip() for n in m.group(1).split(",") if n.strip()}
    m = re.search(r"\n    needs:\n((?:      - [^\n]+\n)+)", block + "\n")
    return {line.strip()[2:] for line in m.group(1).splitlines()} if m else set()


class Workflow(unittest.TestCase):
    """.github/workflows/ci.yml against the map."""

    @classmethod
    def setUpClass(cls):
        with open(CI, encoding="utf-8") as handle:
            cls.text = handle.read()
        cls.jobs = jobs_of(cls.text)

    def test_the_jobs_are_the_suites_plus_plan_and_gate(self):
        self.assertEqual(set(self.jobs), set(SUITES) | {"plan", "gate", "cut"})

    def test_every_suite_job_waits_for_the_plan_and_runs_on_its_word(self):
        for suite in SUITES:
            block = self.jobs[suite]
            self.assertIn("plan", needs_of(block), suite)
            cond = re.search(r"\n    if: \$\{\{ (.*) \}\}\n", block).group(1)
            self.assertIn("!cancelled()", cond, suite)
            self.assertIn("needs.plan.result == 'success'", cond, suite)
            self.assertIn(f"needs.plan.outputs.{suite} == 'true'", cond, suite)

    def test_the_order_names_the_real_gates_and_never_the_plan(self):
        """`contains(needs.*.result, 'failure')` would take the plan in with the rest.

        The condition that orders the layers lists the jobs one by one. The plan is
        read for its word and its success only: a plan that fails skips every suite,
        and `ci gate` turns that skip into a failure instead of a green.
        """
        for suite in SUITES:
            block = self.jobs[suite]
            cond = re.search(r"\n    if: \$\{\{ (.*) \}\}\n", block).group(1)
            self.assertNotIn("needs.*", cond, suite)
            self.assertNotIn("needs.plan.result != ", cond, suite)
            named = set(re.findall(r"needs\.([a-z0-9-]+)\.result != 'failure'", cond))
            self.assertEqual(named, needs_of(block) - {"plan"}, suite)

    def test_no_job_but_the_gate_runs_without_the_word_of_the_plan(self):
        for name, block in self.jobs.items():
            if name in ("plan", "gate", "cut"):
                continue
            self.assertEqual(len(re.findall(r"needs\.plan\.outputs\.", block)), 1, name)

    def test_the_plan_prints_every_suite(self):
        block = self.jobs["plan"]
        for suite in SUITES:
            self.assertRegex(block, rf"\n      {re.escape(suite)}: \$\{{\{{ steps\.plan\.outputs\.{re.escape(suite)} \}}\}}", suite)

    def test_the_gate_waits_for_every_job_and_runs_always(self):
        block = self.jobs["gate"]
        self.assertEqual(needs_of(block), set(SUITES) | {"plan"})
        self.assertIn("if: ${{ always() }}", block)

    def test_the_cut_waits_for_the_first_layer_and_acts_on_a_pull_request_only(self):
        block = self.jobs["cut"]
        self.assertEqual(needs_of(block), {"plan", "line-limit", "actionlint", "bun-version", "ci-scripts", "lint"})
        self.assertIn("failure() && github.event_name == 'pull_request'", block)

    def test_only_the_cut_writes_to_actions_and_its_steps_are_exactly_the_known_ones(self):
        """The write token never meets code the pull request wrote.

        Effective permissions are read: `write-all` counts as `actions: write`, and a
        job without a block of its own has the workflow's. The jobs that can write are
        compared with the one allowed, and its steps are compared, whole, with the
        text of the launcher (a pinned checkout and a step that runs the copy of the
        script held by the base commit). A different step is a different test.
        """
        writers = []
        for path in sorted(glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yml"))):
            with open(path, encoding="utf-8") as handle:
                text = handle.read()
            top = permissions_of(text.split("\njobs:\n", 1)[0], indent=0)
            self.assertIsNotNone(top, f"{os.path.basename(path)} has no permissions block of its own")
            self.assertFalse(grants_actions_write(top), f"{os.path.basename(path)} grants write at the workflow level")
            for name, block in jobs_of(text).items():
                own = permissions_of(block, indent=4)
                effective = own if own is not None else top
                if grants_actions_write(effective):
                    writers.append((os.path.basename(path), name))
        self.assertEqual(writers, [("ci.yml", "cut")])
        block = self.jobs["cut"]
        self.assertEqual(permissions_of(block, indent=4), "contents: read\nactions: write")
        self.assertEqual(block[block.index("    steps:\n"):].rstrip("\n") + "\n", CUT_STEPS)

    def test_no_event_value_is_written_into_a_run_text(self):
        for name, block in self.jobs.items():
            self.assertNotIn("${{ github.event", run_text(block), name)
        for path in glob.glob(os.path.join(ROOT, ".github", "workflows", "*.yml")):
            with open(path, encoding="utf-8") as handle:
                self.assertNotRegex(run_text(handle.read()), r"\$\{\{\s*github\.event\.", os.path.basename(path))

    def run_cut(self, base_has_script):
        """The cut's step, run in a throwaway repository, and what it executed."""
        step = re.search(r"\n        run: \|\n((?:          [^\n]*\n)+)", self.jobs["cut"] + "\n").group(1)
        step = "\n".join(line[10:] for line in step.splitlines())
        with tempfile.TemporaryDirectory() as tmp:
            repo = os.path.join(tmp, "r")
            os.makedirs(os.path.join(repo, "scripts", "ci", "cancel"))
            git = lambda *a: subprocess.run(["git", "-C", repo, *a], check=True, capture_output=True, text=True).stdout.strip()
            git("init", "-q", "-b", "main")
            git("config", "user.email", "t@example.invalid")
            git("config", "user.name", "t")
            git("config", "commit.gpgsign", "false")
            script = os.path.join(repo, "scripts", "ci", "cancel", "others.sh")
            if base_has_script:
                with open(script, "w") as handle:
                    handle.write(f'echo base >> "{tmp}/ran"\n')
            else:
                open(os.path.join(repo, "x"), "w").close()
            git("add", "-A")
            git("commit", "-q", "-m", "base")
            base = git("rev-parse", "HEAD")
            with open(script, "w") as handle:
                handle.write(f'echo pull-request >> "{tmp}/ran"\n')
            git("add", "-A")
            git("commit", "-q", "-m", "change")
            env = dict(os.environ, BASE_SHA=base, RUNNER_TEMP=tmp)
            done = subprocess.run(["bash", "-c", step], cwd=repo, env=env, capture_output=True, text=True)
            marker = os.path.join(tmp, "ran")
            ran = []
            if os.path.exists(marker):
                with open(marker) as handle:
                    ran = handle.read().split()
            return done.returncode, ran

    def test_the_cut_runs_the_base_copy_of_the_script_and_never_the_pull_requests(self):
        code, ran = self.run_cut(base_has_script=True)
        self.assertEqual((code, ran), (0, ["base"]))

    def test_a_base_without_the_script_cancels_nothing_and_does_not_fall_back(self):
        code, ran = self.run_cut(base_has_script=False)
        self.assertEqual((code, ran), (0, []))

    def test_a_job_does_not_switch_itself_off(self):
        self.assertNotIn("continue-on-error", self.text)

    def test_the_layers_hold(self):
        """Cheap first, and a job waits for every job of the layers before it.

        `needs.*.result` only sees the direct needs, so a job that waited for the
        layer above alone would not see a failure two layers up, and would run.
        """
        first = {"line-limit", "actionlint", "bun-version", "ci-scripts", "lint"}
        second = {"unit", "randomized", "debian", "release-scripts"}
        third = {"e2e", "container"}
        self.assertEqual(first | second | third, set(SUITES))
        for suite in first:
            self.assertEqual(needs_of(self.jobs[suite]), {"plan"}, suite)
        for suite in second:
            self.assertEqual(needs_of(self.jobs[suite]), {"plan"} | first, suite)
        for suite in third:
            self.assertEqual(needs_of(self.jobs[suite]), {"plan"} | first | second, suite)

    def test_a_change_to_the_wiring_runs_the_tests_of_the_wiring(self):
        """What watches the CI is watched by the CI: workflows, scripts and the map."""
        for path in [
            ".github/workflows/dco.yml",
            ".github/workflows/ci-e2e.yml",
            ".github/workflows/release.yml",
            ".github/workflows/main-guard.yml",
            "scripts/ci/dco/check.sh",
            "scripts/ci/cancel/others.sh",
            "scripts/ci/plan/map.toml",
            "scripts/ci/plan/gate.py",
            ".github/workflows/ci.yml",
        ]:
            verdict, unclaimed = run_plan([path])
            self.assertTrue(verdict["ci-scripts"], path)
            self.assertEqual(unclaimed, [], path)

    def test_the_workflows_a_job_calls_exist_and_are_callable_only(self):
        for name, block in self.jobs.items():
            m = re.search(r"\n    uses: \./\.github/workflows/([a-z-]+\.yml)\n", block)
            if not m:
                continue
            path = os.path.join(ROOT, ".github", "workflows", m.group(1))
            self.assertTrue(os.path.isfile(path), f"{name} calls {m.group(1)}")
            with open(path, encoding="utf-8") as handle:
                called = handle.read()
            self.assertRegex(called, r"\non:\n  workflow_call:\n\npermissions:\n  contents: read\n", m.group(1))
            self.assertNotRegex(called, r"\n  (push|pull_request|schedule|workflow_dispatch):", m.group(1))


if __name__ == "__main__":
    unittest.main()
