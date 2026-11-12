#!/usr/bin/env bash
# Tests for scripts/version/check-bun-version.sh. Run from anywhere:
#   bash scripts/version/test-check-bun-version.sh
# The script finds the repository from its own location, so each case copies it
# into a tree of its own with a Containerfile and one workflow.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../release/lib/assertions.sh
. "$here/../release/lib/assertions.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
digest=$(printf '0%.0s' $(seq 1 64))

# tree <bun stage line> <copy line> <workflow bun-version> -> root
tree() {
	local root
	root=$(mktemp -d "$tmp/tree.XXXXXX")
	mkdir -p "$root/scripts/version" "$root/.github/workflows"
	cp "$here/check-bun-version.sh" "$root/scripts/version/"
	printf '%s\nFROM node AS builder\n%s\n' "$1" "$2" > "$root/Containerfile"
	printf 'jobs:\n  x:\n    steps:\n      - with:\n          bun-version: %s\n' "$3" > "$root/.github/workflows/x.yml"
	echo "$root"
}
check() { sh "$1/scripts/version/check-bun-version.sh"; }
stage="FROM docker.io/oven/bun:1.4.4-debian@sha256:$digest AS bun"
copy='COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun'

expect_status "the same release in the stage tag and the workflow passes" 0 check "$(tree "$stage" "$copy" 1.4.4)"
expect_status "a workflow on another release is refused" 1 check "$(tree "$stage" "$copy" 1.4.3)"
expect_output "the refusal lists both releases" "1.4.3"
expect_status "a bumped image tag with an old workflow is refused" 1 check "$(tree "${stage/1.4.4/1.5.0}" "$copy" 1.4.4)"
expect_status "a stage without a digest is refused" 1 check "$(tree "FROM docker.io/oven/bun:1.4.4-debian AS bun" "$copy" 1.4.4)"
expect_output "that refusal says the stage is missing" "no 'FROM docker.io/oven/bun"
expect_status "the old comment-only form is refused" 1 check "$(tree "# 1.4.4-debian." "$copy" 1.4.4)"
expect_status "a stage that is never copied from is refused" 1 check "$(tree "$stage" 'COPY --from=docker.io/oven/bun@sha256:'"$digest"' /usr/local/bin/bun /usr/local/bin/bun' 1.4.4)"
expect_output "that refusal says the copy is missing" "never copies Bun"

finish
