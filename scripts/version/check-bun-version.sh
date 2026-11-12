#!/bin/sh
# Fail when the Bun release is not the same everywhere it is written.
# Bun is named in the workflows (`bun-version:`) and in the tag of the
# Containerfile's digest-pinned `FROM docker.io/oven/bun:<version>-debian@sha256:`
# stage. They have to move together: a gate that tests one Bun while the image
# ships another proves nothing. Reads text only; it needs neither Bun nor a
# registry. Which digest belongs to that tag is the registry's to say and
# Dependabot's to keep current, so it is not checked here.
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)

versions=$(
	{
		sed -n 's/^[[:space:]]*bun-version:[[:space:]]*"\{0,1\}\([0-9][0-9.]*\)"\{0,1\}[[:space:]]*$/\1 \.github\/workflows/p' "$root"/.github/workflows/*.yml
		sed -n 's/^FROM[[:space:]]\{1,\}docker\.io\/oven\/bun:\([0-9][0-9.]*\)-debian@sha256:[0-9a-f]\{64\}[[:space:]]\{1,\}AS[[:space:]]\{1,\}bun[[:space:]]*$/\1 Containerfile/p' "$root/Containerfile"
	} | sort -u
)

count=$(printf '%s\n' "$versions" | awk '{print $1}' | sort -u | grep -c . || true)
sources=$(printf '%s\n' "$versions" | grep -c "Containerfile" || true)

if [ "$sources" -eq 0 ]; then
	echo "error: no 'FROM docker.io/oven/bun:<version>-debian@sha256:<digest> AS bun' stage found in the Containerfile" >&2
	exit 1
fi

if ! grep -Eq '^COPY[[:space:]]+--from=bun[[:space:]]' "$root/Containerfile"; then
	echo "error: the Containerfile never copies Bun from the 'bun' stage" >&2
	exit 1
fi

if [ "$count" -ne 1 ]; then
	echo "error: Bun is not the same release everywhere:" >&2
	printf '%s\n' "$versions" >&2
	exit 1
fi

echo "Bun $(printf '%s\n' "$versions" | awk 'NR==1{print $1}') everywhere."
