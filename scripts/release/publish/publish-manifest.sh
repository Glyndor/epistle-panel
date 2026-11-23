#!/usr/bin/env bash
# Join the two per-architecture images into one manifest list and push it under one
# staging tag.
#
# Usage: publish-manifest.sh <registry-image> <staging-tag> <amd64-digest> <arm64-digest>
#
# The members are named by the digests that the push jobs reported for what they pushed
# in this run, never by a tag: a tag in the registry can be moved by anyone who can
# write to the package, a digest cannot name anything else. Before the list is pushed it
# is read back, and it has to hold exactly those two digests, one for each architecture.
# Writes `digest` and `stage` to $GITHUB_OUTPUT. Nothing here makes a public tag: the
# floating and the exact tags are made by promote-tags.sh, after the release is
# published, from the digest this script reports.
set -euo pipefail

usage='usage: publish-manifest.sh <registry-image> <staging-tag> <amd64-digest> <arm64-digest>'
image=${1:?$usage}
stage=${2:?$usage}
amd64=${3:?$usage}
arm64=${4:?$usage}

digest_shape='^sha256:[0-9a-f]{64}$'
for d in "$amd64" "$arm64"; do
	[[ "$d" =~ $digest_shape ]] || { echo "::error::'$d' is not a sha256 digest; the members are named by digest" >&2; exit 1; }
done
[ "$amd64" != "$arm64" ] || { echo "::error::both architectures name the same image" >&2; exit 1; }
[[ "$stage" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$ ]] || { echo "::error::'$stage' is not a tag" >&2; exit 1; }

list="$image:$stage"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

podman manifest create "$list"
podman manifest add "$list" "docker://$image@$amd64"
podman manifest add "$list" "docker://$image@$arm64"

# What the list holds is what was asked for, and nothing else: two members, each
# architecture once, each with the digest its push job reported.
podman manifest inspect "$list" > "$work/index.json"
python3 -I - "$work/index.json" "$amd64" "$arm64" <<'PY'
import json
import sys

index = json.load(open(sys.argv[1]))
want = {"amd64": sys.argv[2], "arm64": sys.argv[3]}
members = index.get("manifests")
if not isinstance(members, list):
    sys.exit("::error::the manifest list has no members")
found = {}
for member in members:
    arch = (member.get("platform") or {}).get("architecture")
    if arch in found:
        sys.exit(f"::error::the manifest list holds {arch} twice")
    found[arch] = member.get("digest")
if len(members) != 2 or found != want:
    sys.exit(f"::error::the manifest list holds {found}, expected {want}")
PY

# `podman manifest inspect --format` does not exist on podman 5.x, so the digest
# comes from the file push writes.
podman manifest push --all --digestfile "$work/digest" "$list"
digest=$(cat "$work/digest" 2>/dev/null || true)
[[ "$digest" =~ $digest_shape ]] || { echo "::error::no digest was written for $stage" >&2; exit 1; }

{
	printf 'digest=%s\n' "$digest"
	printf 'stage=%s\n' "$stage"
} >> "${GITHUB_OUTPUT:-/dev/stdout}"
echo "Staged $image:$stage as $digest"
