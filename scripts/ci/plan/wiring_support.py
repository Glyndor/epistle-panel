"""Shared by the tests of the wiring: the constants, the strict YAML reader, the
one list of workflows and actions, and a throwaway repository.

PyYAML is hash-pinned in requirements.txt. The names and commands below are the
second copy of what ci.yml says, written here so that a test can compare them.
"""

import os
import re
import subprocess
import tempfile
import tomllib
import unittest

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))

with open(os.path.join(HERE, "map.toml"), "rb") as handle:
    DATA = tomllib.load(handle)
SUITES = list(DATA["suites"])
ALWAYS = list(DATA["always"])
# Suites the map knows and ci.yml may have no job for yet (see gate.py).
OPTIONAL = list(DATA.get("optional", []))

FIRST = ["line-limit", "actionlint", "bun-version", "ci-scripts", "lint"]
SECOND = ["unit", "randomized", "debian", "release-scripts"]
THIRD = ["e2e", "container"]

# Every workflow and every action of the tree; nothing else may exist.
FILES = {
    ".github/workflows/audit.yml",
    ".github/workflows/ci-container.yml",
    ".github/workflows/ci-debian.yml",
    ".github/workflows/ci-e2e.yml",
    ".github/workflows/ci-release-scripts.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/codeql.yml",
    ".github/workflows/dco.yml",
    ".github/workflows/dependabot-watch.yml",
    ".github/workflows/folder-limit.yml",
    ".github/workflows/main-guard.yml",
    ".github/workflows/pins.yml",
    ".github/workflows/release.yml",
}
CALLED = {
    "debian": "ci-debian.yml",
    "release-scripts": "ci-release-scripts.yml",
    "e2e": "ci-e2e.yml",
    "container": "ci-container.yml",
}
NAMES = {
    "plan": "plan",
    "line-limit": "line limit",
    "actionlint": "actionlint",
    "bun-version": "bun version",
    "ci-scripts": "ci scripts",
    "lint": "lint",
    "unit": "unit",
    "randomized": "randomized",
    "debian": "debian",
    "release-scripts": "release scripts",
    "e2e": "e2e",
    "container": "container",
    "gate": "${{ github.event_name != 'pull_request' && format('ci gate ({0})', github.event_name) || (github.base_ref == 'main' && 'ci gate (main)' || 'ci gate') }}",
}
# What each inline job runs, and nothing else runs it.
RUNS = {
    "plan": "plan.py",
    "line-limit": "scripts/ci/line-limit/check.sh",
    "actionlint": "actionlint_${ACTIONLINT_VERSION}",
    "bun-version": "scripts/consistency/check-bun-version.sh",
    "ci-scripts": "unittest discover -s scripts/ci/plan",
    "lint": "bun run lint",
    "unit": "scripts/test/coverage.sh",
    "randomized": "scripts/test/randomized.sh 1",
    "gate": "gate.py",
}
# The checks the rulesets require, and the one event each is produced for.
# The base is part of the answer for the gate, whose name varies with it.
REQUIRED = {
    "ci gate": ("ci.yml", "pull_request", "develop"),
    "ci gate (main)": ("ci.yml", "pull_request", "main"),
    "dco / Signed-off-by present on every commit": ("dco.yml", "pull_request", None),
    "folder limit": ("folder-limit.yml", "pull_request", None),
    "develop-only": ("main-guard.yml", "pull_request", None),
}


class StrictLoader(yaml.SafeLoader):
    """SafeLoader that refuses a key written twice in one mapping."""


def _mapping(loader, node, deep=False):
    seen = set()
    for key_node, _ in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in seen:
            raise yaml.constructor.ConstructorError(None, None, f"duplicate key {key!r}", key_node.start_mark)
        seen.add(key)
    return yaml.SafeLoader.construct_mapping(loader, node, deep)


StrictLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, _mapping)


def tracked():
    out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True).stdout
    return [p.decode() for p in out.split(b"\0") if p]


def enumerate_files():
    """The one list of workflows and actions: .yml and .yaml, and action files anywhere."""
    found = set()
    for path in tracked():
        if re.match(r"^\.github/.*\.ya?ml$", path) and path != ".github/dependabot.yml":
            found.add(path)
        if re.search(r"(^|/)action\.ya?ml$", path):
            found.add(path)
    return found


def load(path):
    with open(os.path.join(ROOT, path), encoding="utf-8") as handle:
        return yaml.load(handle, Loader=StrictLoader)


def triggers(doc):
    """The `on:` mapping; YAML 1.1 reads the bare key `on` as true."""
    on = doc.get("on", doc.get(True))
    return on if isinstance(on, dict) else {name: None for name in ([on] if isinstance(on, str) else on)}


def walk(node):
    yield node
    if isinstance(node, dict):
        for value in node.values():
            yield from walk(value)
    elif isinstance(node, list):
        for value in node:
            yield from walk(value)


def runs_of(job):
    return "\n".join(step["run"] for step in job.get("steps", []) if "run" in step)


def step_named(job, name):
    found = [s for s in job["steps"] if s.get("name") == name]
    assert len(found) == 1, f"{len(found)} steps named {name!r}"
    return found[0]


def resolved_name(job, event, base=None):
    """The name a job emits for an event, and for a base when the event is a pull request."""
    name = job.get("name", "")
    if name == NAMES["gate"]:
        if event != "pull_request":
            return f"ci gate ({event})"
        return "ci gate (main)" if base == "main" else "ci gate"
    return name


def names_of(job, event, base=None):
    """Every name a job can emit: a name with a matrix is expanded over its legs."""
    name = resolved_name(job, event, base)
    match = re.fullmatch(r"(.*)\$\{\{ matrix\.([a-z-]+) \}\}(.*)", name)
    if not match:
        return [name]
    legs = (job.get("strategy") or {}).get("matrix", {}).get("include")
    assert isinstance(legs, list), f"a name with a matrix that cannot be expanded: {name}"
    return [f"{match.group(1)}{leg[match.group(2)]}{match.group(3)}" for leg in legs]


def varies_with_base(job):
    return job.get("name", "") == NAMES["gate"]


def present_suites():
    """The suites of the map that ci.yml has a job for: all, but an optional one may have none."""
    jobs = load(".github/workflows/ci.yml")["jobs"]
    return [suite for suite in SUITES if suite in jobs]


class Fixture:
    """A throwaway repository: a base commit and a change on top of it."""

    def __init__(self, tmp, base_files, change_files):
        self.dir = os.path.join(tmp, "repo")
        os.makedirs(self.dir)
        self.git("init", "-q", "-b", "main")
        self.git("config", "user.email", "t@example.invalid")
        self.git("config", "user.name", "t")
        self.git("config", "commit.gpgsign", "false")
        self.write(base_files or {"unrelated": "x"})
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "base")
        self.base = self.git("rev-parse", "HEAD")
        self.write(change_files)
        self.git("add", "-A")
        self.git("commit", "-q", "-m", "change")

    def git(self, *args):
        return subprocess.run(["git", "-C", self.dir, *args], check=True, capture_output=True, text=True).stdout.strip()

    def write(self, files):
        for path, text in files.items():
            full = os.path.join(self.dir, path)
            os.makedirs(os.path.dirname(full), exist_ok=True)
            with open(full, "w", encoding="utf-8") as handle:
                handle.write(text)

    def run(self, script, **env):
        return subprocess.run(["bash", "-c", script], cwd=self.dir, env=dict(os.environ, **env), capture_output=True, text=True)


