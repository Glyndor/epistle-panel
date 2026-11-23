#!/usr/bin/env python3
"""Decide which suites of the CI a change needs.

  plan.py --map map.toml --event pull_request   # reads the diff HEAD^1..HEAD
  plan.py --map map.toml --event push
  plan.py --map map.toml --files-from list.txt  # one path per line, for tests

It prints one `<suite>=true|false` line per suite of the map and nothing else on
stdout, which is what `$GITHUB_OUTPUT` takes. Messages go to stderr.

  pull_request  A suite runs when a changed path matches its `include` and not
                its `exclude`. The diff is the one of the merge commit that
                `actions/checkout` builds: first parent (the base) against the
                commit, so it is what the pull request adds to the base as it is
                now. A change to this machinery runs every suite.
                A change to some lines of a file selects a suite only when one of
                those lines matches the pattern of its [[line_rules]] entry: the
                Containerfile selects what runs Bun through its Bun stage alone. A diff that
                cannot be read, or is empty, runs every suite too: a wrong skip
                lets a change merge unlooked-at, a wrong run costs minutes.
  push          Only the suites marked `push = true`: what describes the state
                of the branch. The tree was tested on its pull request.
  anything else Every suite.

A changed path that no suite claims and the map does not list as `ignore` is an
error (exit 1), after the lines are printed with every suite on: the map must
say what a new kind of file needs, and the job fails until it does.
"""

import argparse
import re
import subprocess
import sys
import tomllib


# Path patterns. `*` is anything but `/`, `?` one character but `/`, `**` anything
# with the `/` included, and `**/` may also match nothing, so `**/*.ts` matches
# `a.ts` at the root as well as `internal/src/a.ts`. Nothing else is special, and
# a pattern that is empty, absolute or climbs with `..` is refused: the map is
# read by the checks that decide what runs, so its language is kept small.


class BadPattern(ValueError):
    pass


def check(pattern: str) -> None:
    if not pattern or pattern.startswith("/") or pattern.startswith("./"):
        raise BadPattern(f"a pattern is a relative path, not {pattern!r}")
    if ".." in pattern.split("/"):
        raise BadPattern(f"a pattern may not climb with '..': {pattern!r}")
    if any(c in pattern for c in "[]{}()!\\\n\t"):
        raise BadPattern(f"unsupported character in pattern {pattern!r}")


def compile_pattern(pattern: str) -> "re.Pattern[str]":
    check(pattern)
    out = []
    i = 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif pattern[i] == "*":
            out.append("[^/]*")
            i += 1
        elif pattern[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(pattern[i]))
            i += 1
    return re.compile("".join(out) + r"\Z")


def matches(patterns: "list[str]", path: str) -> bool:
    return any(compile_pattern(p).match(path) for p in patterns)


def load_map(path: str) -> dict:
    with open(path, "rb") as handle:
        data = tomllib.load(handle)
    suites = data.get("suites")
    if not isinstance(suites, dict) or not suites:
        raise SystemExit(f"{path}: no [suites.*] tables")
    for name, suite in suites.items():
        if not name.replace("-", "").isalnum() or name != name.lower():
            raise SystemExit(f"{path}: suite name {name!r} must be lower case letters, digits and '-'")
        if not suite.get("include"):
            raise SystemExit(f"{path}: suite {name!r} has no include patterns")
    for rule in data.get("line_rules", []):
        if set(rule) != {"path", "pattern", "suites"} or not rule["suites"]:
            raise SystemExit(f"{path}: a [[line_rules]] entry has path, pattern and suites, and nothing else")
        check(rule["path"])
        if "*" in rule["path"] or "?" in rule["path"]:
            raise SystemExit(f"{path}: the path of a line rule is one file, not a pattern: {rule['path']!r}")
        re.compile(rule["pattern"])
        for name in rule["suites"]:
            if name not in suites:
                raise SystemExit(f"{path}: a line rule names the suite {name!r}, which does not exist")
    return data


def changed_files() -> "list[str] | None":
    """The paths the merge commit changes against its first parent, or None."""
    try:
        out = subprocess.run(
            ["git", "diff", "--name-only", "--no-renames", "-z", "HEAD^1", "HEAD"],
            check=True,
            capture_output=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    files = [p.decode("utf-8", "surrogateescape") for p in out.split(b"\0") if p]
    return files or None


def changed_lines(paths: "list[str]") -> "dict[str, list[str] | None]":
    """For each path, the text of the lines the merge commit adds or removes there.

    None for a path whose diff cannot be read: the caller then takes every line to
    have changed."""
    out: "dict[str, list[str] | None]" = {}
    for path in paths:
        try:
            diff = subprocess.run(
                ["git", "diff", "--no-ext-diff", "--no-textconv", "--no-renames", "-U0", "HEAD^1", "HEAD", "--", path],
                check=True,
                capture_output=True,
            ).stdout.decode("utf-8", "surrogateescape")
        except (subprocess.CalledProcessError, FileNotFoundError):
            out[path] = None
            continue
        out[path] = [
            line[1:] for line in diff.splitlines() if line[:1] in "+-" and not line.startswith(("+++", "---"))
        ]
    return out


def line_rule_suites(data: dict, files: "list[str]", lines: "dict[str, list[str] | None] | None") -> "set[str]":
    """The suites that a change to certain lines of a file selects, and no other change to it.

    A path with a rule whose lines are unknown selects its suites: a wrong skip
    lets a change merge unlooked-at, a wrong run costs minutes."""
    chosen: "set[str]" = set()
    for rule in data.get("line_rules", []):
        if rule["path"] not in files:
            continue
        seen = None if lines is None else lines.get(rule["path"])
        if seen is None or any(re.search(rule["pattern"], line) for line in seen):
            chosen.update(rule["suites"])
    return chosen


def selects(suite: dict, path: str) -> bool:
    return matches(suite["include"], path) and not matches(suite.get("exclude", []), path)


def plan(
    data: dict, event: str, files: "list[str] | None", lines: "dict[str, list[str] | None] | None" = None
) -> "tuple[dict[str, bool], list[str]]":
    """The verdict of every suite and the paths nobody claims.

    `lines` holds, for the files that have a line rule, the text of the lines the
    change touches; None means they are not known."""
    suites = data["suites"]
    everything = {name: True for name in suites}
    if event == "push":
        return {name: bool(s.get("push", False)) for name, s in suites.items()}, []
    if event != "pull_request":
        return everything, []
    if files is None:
        print("plan: the diff is unreadable or empty; every suite runs", file=sys.stderr)
        return everything, []

    machinery = data.get("machinery", [])
    ignore = data.get("ignore", {}).get("paths", [])
    if any(matches(machinery, f) for f in files):
        print("plan: a change to the machinery that decides what runs; every suite runs", file=sys.stderr)
        return everything, []

    verdict = {name: False for name in suites}
    unclaimed = []
    for path in files:
        claimed = False
        for name, suite in suites.items():
            if selects(suite, path):
                verdict[name] = True
                claimed = True
        if not claimed and not matches(ignore, path):
            unclaimed.append(path)
    for name in line_rule_suites(data, files, lines):
        verdict[name] = True
    if unclaimed:
        return everything, unclaimed
    return verdict, []


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--map", required=True)
    parser.add_argument("--event", default="pull_request")
    parser.add_argument("--files-from", help="read the changed paths from this file instead of git")
    args = parser.parse_args()

    data = load_map(args.map)
    if args.files_from:
        with open(args.files_from, encoding="utf-8") as handle:
            files = [line.rstrip("\n") for line in handle if line.strip()] or None
    else:
        files = changed_files() if args.event == "pull_request" else None
    lines = None
    if files is not None and not args.files_from:
        lines = changed_lines([r["path"] for r in data.get("line_rules", []) if r["path"] in files])

    verdict, unclaimed = plan(data, args.event, files, lines)
    for name in data["suites"]:
        print(f"{name}={'true' if verdict[name] else 'false'}")
    if unclaimed:
        for path in unclaimed:
            print(f"::error file={path}::no suite of scripts/ci/plan/map.toml claims this path, and it is not listed as ignored", file=sys.stderr)
        return 1
    ran = [n for n in data["suites"] if verdict[n]]
    print(f"plan: {args.event}: {len(ran)} of {len(data['suites'])} suites run: {', '.join(ran) or 'none'}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
