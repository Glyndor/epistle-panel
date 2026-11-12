#!/usr/bin/env python3
"""Print the OCI tags a release should publish for a given version.

Usage:
  image_tags.py <version>

Versions like `v0.9.0` (or `0.9.0` without the leading `v`) publish three
tags: the exact `<major>.<minor>.<patch>`, the floating `<major>.<minor>`,
and the rolling `<major>`. The exact tag points at the build; the other two
point at the same manifest list, so a consumer pinning `0.9` keeps getting
patches and a consumer pinning `0` keeps getting minors.

Pre-release versions like `v1.0.0-rc.1` are not supported and fail. The
release workflow refuses such a tag before anything is built
(scripts/release/version/check_release_tag.py), so a pre-release never reaches this
script, and publishing one here would move `:0` onto a candidate. Supporting
them means changing both scripts together.

Anything else fails. The release job must not publish at all on a tag
the script cannot classify, because what `podman manifest create` and
`podman manifest push` would then do is undefined and the failure shows
up as a half-built manifest list on ghcr.io, which is worse than a
missing release.

Standard library only; no third-party imports on purpose. `release.yml`
runs the script on a vanilla `ubuntu-latest` runner, where a venv for a
classifier would be complexity with nothing to pay for it.
"""
import re
import sys

# Anchored regex: `MAJOR.MINOR.PATCH` exactly, each component `0` or a number
# without a leading zero (semver forbids them). scripts/release/version/
# check_release_tag.py accepts the same shape, so a tag that passes it is never
# refused here, after the release is published.
VERSION_RE = re.compile(
	r"^v?"
	r"(?P<major>0|[1-9][0-9]*)\.(?P<minor>0|[1-9][0-9]*)\.(?P<patch>0|[1-9][0-9]*)"
	r"$"
)


def _die(message: str) -> None:
	"""Print `::error::<message>` on stderr and exit 1.

	`::error::` is the GitHub Actions annotation prefix. It renders the
	message in the workflow run UI as a red error line and lets a
	maintainer see at a glance which step the failure came from, without
	parsing free-form output. A `::error::` that does not also exit
	non-zero is a GitHub UI bug, not a successful step, so the two go
	together.
	"""
	print(f"::error::{message}", file=sys.stderr)
	sys.exit(1)


def tags_for(raw: str) -> list[str]:
	"""Classify `raw` and return the tags it should publish, in order.

	Raises `ValueError` on any input that is not `MAJOR.MINOR.PATCH` with an
	optional leading `v` and no leading zeros. The caller turns the
	`ValueError` into a `::error::` line and a non-zero exit.
	"""
	match = VERSION_RE.match(raw)
	if not match:
		raise ValueError(
			f"'{raw}' is not MAJOR.MINOR.PATCH (pre-release versions are not supported); "
			"refusing to publish"
		)
	major = match.group("major")
	minor = match.group("minor")
	patch = match.group("patch")
	return [f"{major}.{minor}.{patch}", f"{major}.{minor}", major]


def main(argv: list[str]) -> int:
	if len(argv) != 1:
		_die(
			"image_tags.py takes one argument, the version to classify "
			f"(got {len(argv)})"
		)
	try:
		for tag in tags_for(argv[0]):
			print(tag)
	except ValueError as exc:
		_die(str(exc))
	return 0


if __name__ == "__main__":
	sys.exit(main(sys.argv[1:]))
