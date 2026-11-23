#!/usr/bin/env bash
# Tests for scripts/consistency/check-bun-version.sh. Run from anywhere:
#   bash scripts/consistency/test-check-bun-version.sh
# The script finds the repository from its own location, so each case copies it
# into a tree of its own with a Containerfile, the hash file and one workflow.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../release/lib/assertions.sh
. "$here/../release/lib/assertions.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
digest=$(printf '0%.0s' $(seq 1 64))
sum=$(printf 'a%.0s' $(seq 1 64))

# tree <bun stage line> <copy line> <SHA256SUMS content> <workflow step> -> root
tree() {
	local root
	root=$(mktemp -d "$tmp/tree.XXXXXX")
	mkdir -p "$root/scripts/consistency" "$root/scripts/ci/bun" "$root/.github/workflows"
	cp "$here/check-bun-version.sh" "$root/scripts/consistency/"
	printf '%s\nFROM node AS builder\n%s\n' "$1" "$2" >"$root/Containerfile"
	printf '%s' "$3" >"$root/scripts/ci/bun/SHA256SUMS"
	printf 'jobs:\n  x:\n    steps:\n%s\n' "$4" >"$root/.github/workflows/x.yml"
	echo "$root"
}
check() { sh "$1/scripts/consistency/check-bun-version.sh"; }
stage="FROM docker.io/oven/bun:1.4.4-debian@sha256:$digest AS bun"
copy='COPY --from=bun /usr/local/bin/bun /usr/local/bin/bun'
sums="1.4.4 $sum"$'\n'
step='      - run: bash scripts/ci/bun/install.sh'

expect_status "the stage, its hash and a workflow that installs from the script pass" 0 check "$(tree "$stage" "$copy" "$sums" "$step")"
expect_status "a bumped image tag with the old hash is refused" 1 check "$(tree "${stage/1.4.4/1.5.0}" "$copy" "$sums" "$step")"
expect_output "that refusal says what line to add" "SHA256SUMS needs exactly one line '1.5.0"
expect_status "a missing hash file is refused" 1 check "$(tree "$stage" "$copy" "" "$step")"
expect_status "a hash of the wrong length is refused" 1 check "$(tree "$stage" "$copy" "1.4.4 abc"$'\n' "$step")"
expect_status "two hashes for the release are refused" 1 check "$(tree "$stage" "$copy" "$sums$sums" "$step")"
expect_status "a workflow that names a Bun is refused" 1 check "$(tree "$stage" "$copy" "$sums" "      - with:
          bun-version: 1.4.4")"
expect_output "that refusal names the line" "bun-version: 1.4.4"
expect_status "a workflow that runs the third-party action is refused" 1 check "$(tree "$stage" "$copy" "$sums" "      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0")"
expect_status "a stage without a digest is refused" 1 check "$(tree "FROM docker.io/oven/bun:1.4.4-debian AS bun" "$copy" "$sums" "$step")"
expect_output "that refusal says the stage is missing" "no 'FROM docker.io/oven/bun"
expect_status "the old comment-only form is refused" 1 check "$(tree "# 1.4.4-debian." "$copy" "$sums" "$step")"
expect_status "a stage that is never copied from is refused" 1 check "$(tree "$stage" 'COPY --from=docker.io/oven/bun@sha256:'"$digest"' /usr/local/bin/bun /usr/local/bin/bun' "$sums" "$step")"
expect_output "that refusal says the copy is missing" "never copies Bun"

finish
