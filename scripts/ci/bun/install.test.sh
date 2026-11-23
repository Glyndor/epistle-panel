#!/usr/bin/env bash
# Tests of scripts/ci/bun/install.sh against a release served from a folder: the
# right hash installs, and a tampered download, a missing or malformed hash, two
# hashes for one release, a Containerfile without the stage and a binary that
# reports another version are each refused, and nothing is installed.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
digest="$(printf '0%.0s' $(seq 1 64))"

fail=0
ok() { echo "ok   $1"; }
bad() {
	echo "FAIL $1"
	fail=1
}

# fixture <name> [binary version] [Containerfile stage] -> sets $root, $serve
fixture() {
	root="$work/$1"
	serve="$root/serve"
	local reported="${2:-1.4.4}"
	local stage="${3:-FROM docker.io/oven/bun:1.4.4-debian@sha256:$digest AS bun}"
	mkdir -p "$root/scripts/ci/bun" "$serve/bun-v1.4.4" "$root/pack/bun-linux-x64"
	cp "$here/install.sh" "$root/scripts/ci/bun/"
	printf '%s\nFROM node AS builder\n' "$stage" >"$root/Containerfile"
	printf '#!/bin/sh\necho %s\n' "$reported" >"$root/pack/bun-linux-x64/bun"
	chmod +x "$root/pack/bun-linux-x64/bun"
	(cd "$root/pack" && python3 -c "
import zipfile,os
z=zipfile.ZipFile('$serve/bun-v1.4.4/bun-linux-x64.zip','w')
info=zipfile.ZipInfo('bun-linux-x64/bun'); info.external_attr=0o755<<16
z.writestr(info,open('bun-linux-x64/bun','rb').read()); z.close()")
	hash="$(sha256sum "$serve/bun-v1.4.4/bun-linux-x64.zip" | cut -d' ' -f1)"
	printf '1.4.4 %s\n' "$hash" >"$root/scripts/ci/bun/SHA256SUMS"
}

# attempt -> exit status; installs into $root/out
attempt() {
	rm -rf "$root/out"
	: >"$root/path"
	BUN_DIR="$root/out" BUN_BASE_URL="file://$serve" GITHUB_PATH="$root/path" bash "$root/scripts/ci/bun/install.sh" >"$root/log" 2>&1
}

[ "$(uname -s)-$(uname -m)" = "Linux-x86_64" ] || {
	echo "skipped: the installer covers linux x86_64 only"
	exit 0
}

fixture good
if attempt && [ -x "$root/out/bin/bun" ] && grep -q "$root/out/bin" "$root/path"; then ok "the release with its hash installs and joins the path"; else
	bad "the release with its hash installs"
	cat "$root/log"
fi

fixture tampered
printf 'x' >>"$serve/bun-v1.4.4/bun-linux-x64.zip"
if attempt; then bad "a tampered download is refused"; elif [ ! -e "$root/out/bin/bun" ] && grep -q "does not match" "$root/log"; then ok "a tampered download is refused and nothing is installed"; else bad "a tampered download is refused for the hash"; fi

fixture nosum
: >"$root/scripts/ci/bun/SHA256SUMS"
if attempt; then bad "a release without a hash is refused"; elif grep -q "no single sha256" "$root/log"; then ok "a release without a hash is refused"; else bad "a release without a hash is refused for the hash"; fi

fixture shorthash
printf '1.4.4 abc123\n' >"$root/scripts/ci/bun/SHA256SUMS"
if attempt; then bad "a malformed hash is refused"; else ok "a malformed hash is refused"; fi

fixture twosums
printf '1.4.4 %s\n1.4.4 %s\n' "$hash" "$hash" >"$root/scripts/ci/bun/SHA256SUMS"
if attempt; then bad "two hashes for one release are refused"; else ok "two hashes for one release are refused"; fi

fixture otherversion
printf '1.4.3 %s\n' "$hash" >"$root/scripts/ci/bun/SHA256SUMS"
if attempt; then bad "a hash for another release is refused"; else ok "a hash for another release is refused"; fi

fixture nostage 1.4.4 "FROM docker.io/oven/bun:1.4.4-debian AS bun"
if attempt; then bad "a Containerfile without the pinned stage is refused"; else ok "a Containerfile without the pinned stage is refused"; fi

fixture wrongbinary 9.9.9
if attempt; then bad "a binary that reports another version is refused"; elif grep -q "reports 9.9.9" "$root/log"; then ok "a binary that reports another version is refused"; else bad "refused for the version"; fi

fixture nodir
if BUN_DIR="" RUNNER_TEMP="" BUN_BASE_URL="file://$serve" bash "$root/scripts/ci/bun/install.sh" >/dev/null 2>&1; then bad "no target directory is refused"; else ok "no target directory is refused"; fi

exit "$fail"
