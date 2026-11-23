#!/bin/sh
# Fail when the Bun release is not written down in one place and checked.
# Bun is the tag of the Containerfile's digest-pinned
# `FROM docker.io/oven/bun:<version>-debian@sha256:...` stage, which Dependabot
# moves, and scripts/ci/bun/install.sh installs that release in every job that
# needs it, after checking it against scripts/ci/bun/SHA256SUMS. So a gate that
# tests one Bun while the image ships another cannot happen, as long as:
#   - the Containerfile has the stage and copies Bun from it;
#   - SHA256SUMS has one line for that release, with a 64-digit hash;
#   - no workflow names a Bun release of its own or runs a third-party action to
#     get one (`bun-version:`, `setup-bun`), which would be a second source.
# Reads text only; it needs neither Bun nor a registry. Which digest belongs to
# the tag is the registry's to say and Dependabot's to keep current.
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)

version=$(sed -n 's/^FROM[[:space:]]\{1,\}docker\.io\/oven\/bun:\([0-9][0-9.]*\)-debian@sha256:[0-9a-f]\{64\}[[:space:]]\{1,\}AS[[:space:]]\{1,\}bun[[:space:]]*$/\1/p' "$root/Containerfile")

if [ -z "$version" ]; then
	echo "error: no 'FROM docker.io/oven/bun:<version>-debian@sha256:<digest> AS bun' stage found in the Containerfile" >&2
	exit 1
fi
if [ "$(printf '%s\n' "$version" | wc -l)" -ne 1 ]; then
	echo "error: the Containerfile has more than one Bun stage: $version" >&2
	exit 1
fi

if ! grep -Eq '^COPY[[:space:]]+--from=bun[[:space:]]' "$root/Containerfile"; then
	echo "error: the Containerfile never copies Bun from the 'bun' stage" >&2
	exit 1
fi

lines=$(awk -v v="$version" '$1 == v' "$root/scripts/ci/bun/SHA256SUMS" 2>/dev/null || true)
if [ "$(printf '%s' "$lines" | grep -c .)" -ne 1 ] || ! printf '%s\n' "$lines" | grep -Eq "^$version [0-9a-f]{64}$"; then
	echo "error: scripts/ci/bun/SHA256SUMS needs exactly one line '$version <sha256 of bun-linux-x64.zip>'" >&2
	echo "       take it from SHASUMS256.txt of https://github.com/oven-sh/bun/releases/tag/bun-v$version" >&2
	exit 1
fi

second=$(grep -nE '^[[:space:]]*(-[[:space:]]+)?(bun-version:[[:space:]]*[^[:space:]$]|uses:[[:space:]]*oven-sh/setup-bun)' "$root"/.github/workflows/*.yml || true)
if [ -n "$second" ]; then
	echo "error: a workflow names a Bun of its own; use scripts/ci/bun/install.sh:" >&2
	printf '%s\n' "$second" >&2
	exit 1
fi

echo "Bun $version everywhere."
