#!/usr/bin/env bash
# Install the Bun release the Containerfile names, from the release asset, after
# checking it against the SHA-256 this repository holds.
#
#   scripts/ci/bun/install.sh
#
# This replaces the third-party action that did it. The release is the tag of the
# `FROM docker.io/oven/bun:<version>-debian@sha256:... AS bun` stage of the
# Containerfile, the one Dependabot moves, so there is one place that says which
# Bun the CI, the release and the image use. The hash of its linux-x64 build is in
# scripts/ci/bun/SHA256SUMS; a release with no line there is refused, and
# scripts/consistency/check-bun-version.sh fails on a Containerfile that moved
# without it. The line is the one the release publishes in its SHASUMS256.txt:
#
#   <version> <sha256 of bun-linux-x64.zip>
#
# Settings, from the environment:
#   BUN_DIR       where bun is put, as <dir>/bin/bun (default $RUNNER_TEMP/bun)
#   BUN_BASE_URL  the release downloads (default https://github.com/oven-sh/bun/releases/download)
#
# On a runner the bin directory is added to $GITHUB_PATH. No cache is read or
# written, which matters in the release workflow.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
base_url="${BUN_BASE_URL:-https://github.com/oven-sh/bun/releases/download}"
dir="${BUN_DIR:-${RUNNER_TEMP:-}/bun}"
if [ "$dir" = "/bun" ]; then
	echo "install: BUN_DIR or RUNNER_TEMP must be set" >&2
	exit 2
fi

case "$(uname -s)-$(uname -m)" in
Linux-x86_64) asset=bun-linux-x64.zip ;;
*)
	echo "install: only linux x86_64 is covered, not $(uname -s) $(uname -m)" >&2
	exit 1
	;;
esac

version="$(sed -n 's/^FROM[[:space:]]\{1,\}docker\.io\/oven\/bun:\([0-9][0-9.]*\)-debian@sha256:[0-9a-f]\{64\}[[:space:]]\{1,\}AS[[:space:]]\{1,\}bun[[:space:]]*$/\1/p' "$root/Containerfile")"
if [ -z "$version" ] || [ "$(printf '%s\n' "$version" | wc -l)" -ne 1 ]; then
	echo "install: the Containerfile has no single 'FROM docker.io/oven/bun:<version>-debian@sha256:<digest> AS bun' stage" >&2
	exit 1
fi

expected="$(awk -v v="$version" '$1 == v { print $2 }' "$root/scripts/ci/bun/SHA256SUMS")"
case "$expected" in
[0-9a-f][0-9a-f]*) [ "${#expected}" -eq 64 ] || expected="" ;;
*) expected="" ;;
esac
if [ -z "$expected" ] || [ "$(awk -v v="$version" '$1 == v' "$root/scripts/ci/bun/SHA256SUMS" | wc -l)" -ne 1 ]; then
	echo "install: scripts/ci/bun/SHA256SUMS has no single sha256 for Bun $version; add the line from the release's SHASUMS256.txt" >&2
	exit 1
fi

work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
curl --fail --silent --show-error --location --retry 3 \
	--output "$work/$asset" "${base_url}/bun-v${version}/${asset}"
echo "${expected}  $work/$asset" | sha256sum --check --strict --quiet || {
	echo "install: the download of Bun $version does not match the hash in scripts/ci/bun/SHA256SUMS" >&2
	exit 1
}

unzip -q -o "$work/$asset" -d "$work/unpacked"
mkdir -p "$dir/bin"
install -m 0755 "$work/unpacked/bun-linux-x64/bun" "$dir/bin/bun"

got="$("$dir/bin/bun" --version)"
if [ "$got" != "$version" ]; then
	echo "install: installed Bun reports $got, expected $version" >&2
	exit 1
fi
if [ -n "${GITHUB_PATH:-}" ]; then
	echo "$dir/bin" >>"$GITHUB_PATH"
fi
echo "Bun $got installed in $dir/bin"
