#!/usr/bin/env python3
"""Refuse a release whose version stamps disagree.

Usage:
	check_release_tag.py <tag>

The tag (`vMAJOR.MINOR.PATCH`), `version` in internal/package.json and the top
entry of debian/changelog must all name the same version. dpkg-buildpackage
reads the .deb version from debian/changelog and nowhere else, so a changelog
left behind produces a package labelled with the version users already have:
apt then reports nothing to upgrade and the release never reaches them. The
release runs once and cannot be amended, so the check runs before anything is
built.

Run from the repository root. Standard library only.
"""
import json
import re
import sys

PACKAGE = "epistle-panel"
TAG_RE = re.compile(r"^v([0-9]+\.[0-9]+\.[0-9]+)$")
# `epistle-panel (0.1.0) unstable; urgency=medium`. The whole text between the
# parentheses is the version, revision included: the release binds the package
# to the tag by equality, so a `-1` revision would not match and is refused.
CHANGELOG_RE = re.compile(r"^" + re.escape(PACKAGE) + r" \(([^)\s]+)\) ")


def die(message: str) -> None:
	print(f"::error::{message}", file=sys.stderr)
	sys.exit(1)


def main(argv: list[str]) -> None:
	if len(argv) != 1:
		die("check_release_tag.py takes one argument, the tag")
	match = TAG_RE.match(argv[0])
	if not match:
		die(f"{argv[0]} is not a release tag of the form vMAJOR.MINOR.PATCH")
	tag_version = match.group(1)

	with open("internal/package.json", encoding="utf-8") as fh:
		manifest = json.load(fh)
	manifest_version = manifest.get("version")
	if manifest_version != tag_version:
		die(f"tag {argv[0]} does not match internal/package.json version {manifest_version}")

	with open("debian/changelog", encoding="utf-8") as fh:
		first = fh.readline()
	entry = CHANGELOG_RE.match(first)
	if not entry:
		die(f"the first line of debian/changelog is not a {PACKAGE} entry: {first.strip()!r}")
	if entry.group(1) != tag_version:
		die(
			f"debian/changelog is at {entry.group(1)} but the tag is {tag_version}; "
			"add a changelog entry so the .deb carries the released version"
		)
	print(f"{argv[0]} matches internal/package.json and debian/changelog")


if __name__ == "__main__":
	main(sys.argv[1:])
