#!/usr/bin/env bash
# Tests for scripts/release/version/check-changelog.sh. Run from anywhere:
#   bash scripts/release/version/test-check-changelog.sh
# The script finds the repository from its own location, so each case copies it
# into a small tree of its own with the two files it reads.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../lib/assertions.sh
. "$here/../lib/assertions.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# tree <package.json version line or ""> <first line of debian/changelog or ""> -> root
tree() {
	local root
	root=$(mktemp -d "$tmp/tree.XXXXXX")
	mkdir -p "$root/scripts/release/version" "$root/internal" "$root/debian"
	cp "$here/check-changelog.sh" "$root/scripts/release/version/"
	printf '{\n\t"name": "x",\n%s\n}\n' "$1" > "$root/internal/package.json"
	printf '%s\n\n  * Entry.\n' "$2" > "$root/debian/changelog"
	echo "$root"
}
check() { sh "$1/scripts/release/version/check-changelog.sh"; }

expect_status "the same version in both passes" 0 check "$(tree '	"version": "0.4.0",' 'epistle-panel (0.4.0) unstable; urgency=medium')"
expect_status "a changelog left behind is refused" 1 check "$(tree '	"version": "0.5.0",' 'epistle-panel (0.4.0) unstable; urgency=medium')"
expect_output "the refusal names the package.json version" "0.5.0"
expect_status "a package.json ahead of the changelog is refused" 1 check "$(tree '	"version": "0.4.1",' 'epistle-panel (0.4.0) unstable; urgency=medium')"
expect_status "a Debian revision does not equal the version" 1 check "$(tree '	"version": "0.4.0",' 'epistle-panel (0.4.0-1) unstable; urgency=medium')"
expect_status "a changelog with no entry is refused" 1 check "$(tree '	"version": "0.4.0",' '')"
expect_output "the refusal says a version could not be read" "could not read a version"
expect_status "a package.json with no version is refused" 1 check "$(tree '	"private": true' 'epistle-panel (0.4.0) unstable; urgency=medium')"
expect_output "that refusal says so too" "could not read a version"

finish
