#!/usr/bin/env bash
# Join the two per-architecture images into one manifest list and push it
# under every tag the version publishes.
#
# Usage: publish_manifest.sh <registry-image> <version>
#
# Needs the <version>-amd64 and <version>-arm64 images already pushed. Writes
# `tags` and `digest` to $GITHUB_OUTPUT. All tags point at the same list, and
# the script refuses to finish if the registry digests disagree, because the
# provenance attestation is made against that one digest.
set -euo pipefail

image=${1:?usage: publish_manifest.sh <registry-image> <version>}
version=${2:?usage: publish_manifest.sh <registry-image> <version>}
version=${version#v}
here=$(cd "$(dirname "$0")" && pwd)

# image_tags.py decides which tags a version publishes. A prerelease gets the
# exact tag only: a floating tag would move `:0` onto a candidate and a
# consumer pinning the major would pull it as if it were the next stable.
mapfile -t tags < <(python3 "$here/image_tags.py" "$version")
if [ "${#tags[@]}" -eq 0 ]; then
	echo "::error::image_tags.py produced no tags for $version" >&2
	exit 1
fi
echo "Publishing tags: ${tags[*]}"

digest=""
for tag in "${tags[@]}"; do
	podman manifest create "$image:$tag"
	podman manifest add "$image:$tag" "docker://$image:$version-amd64"
	podman manifest add "$image:$tag" "docker://$image:$version-arm64"
	# `podman manifest inspect --format` does not exist on podman 5.x, so the
	# digest comes from the file push writes.
	podman manifest push --all --digestfile "$RUNNER_TEMP/digest-$tag" "$image:$tag"
	d=$(cat "$RUNNER_TEMP/digest-$tag")
	[ -n "$d" ] || { echo "::error::no digest was written for tag $tag" >&2; exit 1; }
	if [ -z "$digest" ]; then
		digest=$d
	elif [ "$d" != "$digest" ]; then
		echo "::error::tag $tag digest $d differs from $digest; the published tags must point at the same list" >&2
		exit 1
	fi
done

{
	printf 'digest=%s\n' "$digest"
	printf 'tags<<EOF\n'
	printf '%s\n' "${tags[@]}"
	printf 'EOF\n'
} >> "${GITHUB_OUTPUT:-/dev/stdout}"
echo "Manifest digest for $image:$version: $digest"
