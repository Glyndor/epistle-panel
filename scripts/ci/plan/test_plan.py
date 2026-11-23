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
    "tools/y/action.yml": {"action-pins"},
    "tools/y/action.yaml": {"action-pins"},
    ".github/dependabot.yml": {"ci-scripts", "action-pins"},
    ".github/folder-limit-exceptions.txt": {"ci-scripts", "action-pins"},
    ".github/actions/x/action.yml": set(SUITES),
    ".github/anything/at/all.txt": {"ci-scripts", "action-pins"},
    "scripts/ci/pins/check.sh": {"ci-scripts", "action-pins"},
    "scripts/folder-limit/folder-limit.sh": set(),
    "internal/src/app/page.tsx": APP | SHIPPED,
    "internal/src/features/mail/index.test.ts": APP,
    "internal/src/features/mail/index.test.tsx": APP,
    "internal/src/test/setup/index.ts": APP,
    "internal/src/lib/x/test-support/fake.ts": APP,
    "internal/src/messages/en.json": APP | SHIPPED,
    "internal/biome.json": {"lint"},
    "internal/components.json": {"lint"},
    "internal/.gitignore": set(),
    "internal/bunfig.toml": APP,
    "internal/package.json": APP | SHIPPED | {"debian"},
    "internal/bun.lock": APP | SHIPPED,
    "internal/next.config.ts": APP | SHIPPED,
    "scripts/test/coverage.sh": {"unit", "randomized"},
    "scripts/e2e/run.sh": {"e2e"},
    "scripts/e2e/scenarios/auth/login.ts": {"e2e"},
    "scripts/headers/verify.sh": {"e2e"},
    "Containerfile": APP | {"container", "bun-version", "e2e"},
    ".containerignore": {"container"},
    "scripts/consistency/check-base-indexes.sh": {"container", "bun-version"},
    "scripts/consistency/check-bun-version.sh": {"bun-version"},
    "debian/control": {"debian"},
    "debian/changelog": {"debian"},
    "scripts/debian/build.sh": {"debian"},
    "scripts/release/version/check-changelog.sh": {"debian", "release-scripts"},
    "scripts/release/sign/sign.py": {"release-scripts"},
    "scripts/release/lib/assertions.sh": {"release-scripts", "bun-version"},
    ".github/workflows/dco.yml": set(SUITES),
    ".github/workflows/ci-e2e.yml": set(SUITES),
    "scripts/ci/dco/check.sh": {"ci-scripts"},
    "scripts/ci/freshness/check.test.sh": {"ci-scripts"},
    "scripts/ci/dependabot_security_watch.py": {"ci-scripts"},
}

# A change to the machinery runs everything.
MACHINERY = [
    "scripts/ci/bun/install.sh",
    "scripts/ci/bun/SHA256SUMS",
    ".github/workflows/ci.yml",
    ".github/workflows/ci-e2e.yml",
    ".github/workflows/ci-container.yml",
    ".github/workflows/ci-debian.yml",
    ".github/workflows/ci-release-scripts.yml",
    ".github/workflows/dco.yml",
    ".github/workflows/release.yml",
    ".github/workflows/audit.yml",
    ".github/actions/anything/action.yml",
    "scripts/ci/plan/plan.py",
    "scripts/ci/plan/map.toml",
    "scripts/ci/plan/gate.py",
    "scripts/ci/plan/test_plan.py",
]


# Prose is the one kind of file that needs no suite. Everything else is below.
PROSE = ["**/*.md", "docs/**", "LICENSE"]
NOTHING = set()
# (patterns, suites) in order; the first that matches a file is its expectation.
# A callable gets the set of all suites.
EXPECTED = [
    (["scripts/ci/plan/**", "scripts/ci/bun/**", ".github/workflows/**", ".github/actions/**"], lambda everything: everything),
    ([".editorconfig", ".gitignore", "internal/.gitignore", "scripts/folder-limit/**"], NOTHING),
    ([".github/dependabot.yml", ".github/folder-limit-exceptions.txt"], {"ci-scripts", "action-pins"}),
    (["scripts/ci/pins/**"], {"ci-scripts", "action-pins"}),
    (["scripts/ci/**"], {"ci-scripts"}),
    (["internal/package.json"], APP | SHIPPED | {"debian"}),
    (["internal/bun.lock", "internal/next.config.ts", "internal/postcss.config.mjs", "internal/tsconfig.json"], APP | SHIPPED),
    (["internal/bunfig.toml"], APP),
    (["internal/biome.json", "internal/components.json"], {"lint"}),
    (["internal/src/**/*.test.ts", "internal/src/**/*.test.tsx", "internal/src/test/**", "internal/src/**/test-support/**"], APP),
    (["internal/src/**"], APP | SHIPPED),
    (["Containerfile"], APP | {"container", "bun-version", "e2e"}),
    ([".containerignore"], {"container"}),
    (["debian/**", "scripts/debian/**"], {"debian"}),
    (["scripts/release/version/check-changelog.sh"], {"debian", "release-scripts"}),
    (["scripts/release/lib/assertions.sh"], {"release-scripts", "bun-version"}),
    (["scripts/release/**"], {"release-scripts"}),
    (["scripts/consistency/check-base-indexes.sh"], {"container", "bun-version"}),
    (["scripts/consistency/**"], {"bun-version"}),
    (["scripts/e2e/**", "scripts/headers/**"], {"e2e"}),
    (["scripts/test/**"], {"unit", "randomized"}),
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

    def test_the_bun_line_of_the_containerfile_selects_the_suites_that_run_bun_and_no_other_line_does(self):
        """The installer reads the release of Bun from that line, so it moves lint, unit, randomized and e2e."""

        def chosen(lines):
            verdict, unclaimed = plan.plan(DATA, "pull_request", ["Containerfile"], {"Containerfile": lines})
            self.assertEqual(unclaimed, [])
            return {s for s, on in verdict.items() if on}

        node = ["FROM docker.io/library/node@sha256:" + "a" * 64 + " AS builder"]
        bun = ["FROM docker.io/oven/bun:1.4.5-debian@sha256:" + "b" * 64 + " AS bun"]
        base = {"container", "bun-version"}
        self.assertEqual(chosen(node), base)
        self.assertEqual(chosen(["# a comment about the Node base"]), base)
        self.assertEqual(chosen(["FROM gcr.io/distroless/nodejs26-debian13@sha256:" + "c" * 64]), base)
        self.assertEqual(chosen(bun), base | {"lint", "unit", "randomized", "e2e"})
        self.assertEqual(chosen(node + bun), base | {"lint", "unit", "randomized", "e2e"})
        self.assertEqual(chosen(["FROM docker.io/oven/bunny:1"]), base, "only the stage of Bun, whose name is not a prefix match of another image")
        self.assertEqual(chosen(None), base | {"lint", "unit", "randomized", "e2e"}, "lines that cannot be read select the suites")
        verdict, _ = plan.plan(DATA, "pull_request", ["Containerfile"], None)
        self.assertTrue(all(verdict[s] for s in ("lint", "unit", "randomized", "e2e")), "no lines at all select them too")

    def test_the_lines_come_from_the_merge_commit_and_the_command_asks_for_them(self):
        with tempfile.TemporaryDirectory() as tmp:
            def git(*args):
                subprocess.run(["git", "-C", tmp, *args], check=True, capture_output=True)

            git("init", "-q", "-b", "main")
            git("config", "user.email", "t@example.invalid")
            git("config", "user.name", "t")
            git("config", "commit.gpgsign", "false")
            node, bun = "FROM docker.io/library/node@sha256:" + "a" * 64 + " AS builder\n", "FROM docker.io/oven/bun:1.4.4-debian@sha256:" + "b" * 64 + " AS bun\n"
            for name, first, second, want_bun in (
                ("node", (bun, node), (bun, node.replace("a", "c")), False),
                ("bun", (bun, node), (bun.replace("1.4.4", "1.4.5"), node), True),
            ):
                with open(os.path.join(tmp, "Containerfile"), "w") as handle:
                    handle.write("".join(first))
                git("add", "-A")
                git("commit", "-q", "-m", f"base {name}")
                with open(os.path.join(tmp, "Containerfile"), "w") as handle:
                    handle.write("".join(second))
                git("add", "-A")
                git("commit", "-q", "-m", f"change {name}")
                done = subprocess.run([sys.executable, "-I", os.path.join(HERE, "plan.py"), "--map", MAP, "--event", "pull_request"], cwd=tmp, capture_output=True, text=True)
                out = dict(line.split("=") for line in done.stdout.split())
                self.assertEqual(done.returncode, 0, done.stderr)
                self.assertEqual(out["container"], "true", name)
                self.assertEqual(out["lint"], "true" if want_bun else "false", name)
                self.assertEqual(out["e2e"], "true" if want_bun else "false", name)

    def test_a_line_rule_names_one_file_a_pattern_that_compiles_and_suites_that_exist(self):
        with tempfile.TemporaryDirectory() as tmp:
            for rule in (
                'path = "*.md"\npattern = "x"\nsuites = ["lint"]',
                'path = "Containerfile"\npattern = "("\nsuites = ["lint"]',
                'path = "Containerfile"\npattern = "x"\nsuites = ["nope"]',
                'path = "Containerfile"\npattern = "x"\nsuites = []',
                'path = "Containerfile"\npattern = "x"\nsuites = ["lint"]\nextra = 1',
            ):
                bad = os.path.join(tmp, "map.toml")
                with open(bad, "w") as handle:
                    handle.write('[suites.lint]\ninclude = ["a"]\n[[line_rules]]\n' + rule + "\n")
                with self.assertRaises((SystemExit, plan.BadPattern, re.error), msg=rule):
                    plan.load_map(bad)

    def test_a_change_only_to_a_called_workflow_runs_the_suite_it_calls(self):
        """It used to select no suite: the checks that read its text passed, and the suite was skipped."""
        for path, suite in (
            (".github/workflows/ci-e2e.yml", "e2e"),
            (".github/workflows/ci-container.yml", "container"),
            (".github/workflows/ci-debian.yml", "debian"),
            (".github/workflows/ci-release-scripts.yml", "release-scripts"),
        ):
            verdict, unclaimed = run_plan([path])
            self.assertTrue(verdict[suite], path)
            self.assertEqual(unclaimed, [])

    def test_what_is_next_to_the_workflows_is_not_machinery_but_has_its_pins_looked_at(self):
        for path in (".github/dependabot.yml", ".github/folder-limit-exceptions.txt"):
            verdict, _ = run_plan([path])
            self.assertEqual({s for s, on in verdict.items() if on}, {"action-pins"}, path)

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
        for event in ("workflow_dispatch", "schedule", "merge_group", "promotion", ""):
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
        # The one pattern that may match nothing: the folder of local actions, which
        # does not exist yet. A closed list, not a rule.
        no_action_yet = (".github/actions/**", "**/action.yml", "**/action.yaml")
        for pattern in [p for p in patterns if p not in no_action_yet]:
            self.assertTrue(any(plan.matches([pattern], f) for f in self.files), f"{pattern} matches no tracked file")
        self.assertFalse([f for f in self.files if plan.matches(list(no_action_yet), f)], "an action exists: take its patterns off the list above")

    def test_the_suites_of_every_file_that_is_not_prose_are_the_expected_ones(self):
        """The map written a second time, by hand, for every tracked file.

        Moving a toolchain file, a lockfile, the installer or a workflow to "no
        suite", or taking a workflow out of the suite that watches it, changes the
        suites of some file below and fails here: the answer is not read off the map.
        """
        everything = set(SUITES)
        for path in self.files:
            if plan.matches(PROSE, path):
                continue
            expected = next((want for patterns, want in EXPECTED if plan.matches(patterns, path)), None)
            self.assertIsNotNone(expected, f"{path}: no expectation written for this file")
            verdict, unclaimed = run_plan([path])
            self.assertEqual(unclaimed, [], path)
            self.assertEqual({s for s, on in verdict.items() if on}, expected(everything) if callable(expected) else expected, path)

    def test_the_side_with_no_suite_is_this_list_and_no_other(self):
        self.assertEqual(
            DATA["ignore"]["paths"],
            ["**/*.md", "docs/**", "LICENSE", ".editorconfig", ".gitignore", "internal/.gitignore", "scripts/folder-limit/**"],
        )
        self.assertEqual(DATA["machinery"], ["scripts/ci/plan/**", "scripts/ci/bun/**", ".github/workflows/**", ".github/actions/**"])
        self.assertEqual(DATA["always"], ["line-limit"])

    def test_an_optional_suite_claims_nothing_the_others_do_not_judge(self):
        """A suite without a job judges nothing, so a path only it reads would be taken for judged.

        Every path an optional suite selects, tracked or not, is selected by another
        suite that is not optional, or is machinery, or is ignored on purpose.
        """
        with open(CI, encoding="utf-8") as handle:
            ci_text = handle.read()
        # The suites with no job in ci.yml: the others judge, and are not asked about here.
        optional = {n for n in DATA.get("optional", []) if not re.search(rf"\n  {n}:\n", ci_text)}
        others = {n: s for n, s in DATA["suites"].items() if n not in optional}
        hypothetical = [".github/actions/x/action.yml", ".github/other/file.txt", "scripts/ci/pins/new.py", ".github/workflows/new.yml"]
        for path in list(self.files) + hypothetical:
            if any(plan.selects(DATA["suites"][name], path) for name in optional):
                judged = (
                    any(plan.selects(s, path) for s in others.values())
                    or plan.matches(DATA.get("machinery", []), path)
                    or plan.matches(DATA["ignore"]["paths"], path)
                )
                self.assertTrue(judged, f"{path} is read only by an optional suite, which does not run")

    def test_a_path_under_github_that_nothing_else_names_still_runs_the_wiring_tests(self):
        for path in (".github/anything/at/all.txt", ".github/dependabot.yml"):
            verdict, unclaimed = run_plan([path])
            self.assertEqual(unclaimed, [], path)
            self.assertTrue(verdict["ci-scripts"], path)

    def test_every_ignore_pattern_covers_a_file_nobody_else_reads(self):
        """An ignore that only repeats what a suite reads is a pattern to delete."""
        for pattern in DATA["ignore"]["paths"]:
            alone = [
                f
                for f in self.files
                if plan.matches([pattern], f) and not any(plan.selects(s, f) for s in DATA["suites"].values())
            ]
            self.assertTrue(alone, f"{pattern} ignores nothing a suite would not read")


if __name__ == "__main__":
    unittest.main()
