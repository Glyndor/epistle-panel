#!/usr/bin/env bash
# Fail when a base image the Containerfile pins by digest is not a
# multi-architecture index that lists both linux/amd64 and linux/arm64.
#
# Usage: check-base-indexes.sh [Containerfile]
#
# The release builds the image on an amd64 and an arm64 runner from the same
# file, and nothing builds the arm64 one before a release does. A digest that
# names a single-architecture image would only fail there, after the release is
# published. This reads each pinned digest from the registry with
# `podman manifest inspect`, which fetches the manifest and pulls no layers.
set -euo pipefail

file=${1:-$(cd "$(dirname "$0")/../.." && pwd)/Containerfile}

# `FROM <ref>@sha256:...` and `COPY --from=<ref>@sha256:...`.
mapfile -t refs < <(grep -Eo '(FROM[[:space:]]+(--platform=[^[:space:]]+[[:space:]]+)?|--from=)[^[:space:]]+@sha256:[0-9a-f]{64}' "$file" | sed -E 's/^.*[[:space:]=]//' | sort -u)
if [ "${#refs[@]}" -eq 0 ]; then
	echo "::error::no digest-pinned base image found in $file" >&2
	exit 1
fi

for ref in "${refs[@]}"; do
	# Older podman releases reject `name:tag@sha256:...`; the digest alone names
	# the manifest, so drop the tag before asking the registry.
	repo=${ref%@*}
	digest=${ref##*@}
	if [[ "${repo##*/}" == *:* ]]; then
		repo=${repo%:*}
	fi
	if ! manifest=$(podman manifest inspect "$repo@$digest" 2>&1); then
		echo "::error::podman manifest inspect $ref failed: $manifest" >&2
		exit 1
	fi
	archs=$(printf '%s' "$manifest" | python3 -I -c '
import json, sys
doc = json.load(sys.stdin)
media = doc.get("mediaType", "")
if media not in ("application/vnd.oci.image.index.v1+json",
                 "application/vnd.docker.distribution.manifest.list.v2+json"):
	print("NOT-AN-INDEX " + media)
	sys.exit(0)
print(" ".join(sorted(
	m["platform"]["architecture"] for m in doc.get("manifests", [])
	if m.get("platform", {}).get("os") == "linux"
)))
')
	case "$archs" in
		NOT-AN-INDEX*)
			echo "::error::$ref is not a multi-architecture index (${archs#NOT-AN-INDEX })" >&2
			exit 1
			;;
	esac
	for want in amd64 arm64; do
		case " $archs " in
			*" $want "*) ;;
			*) echo "::error::$ref does not list linux/$want (it lists: $archs)" >&2; exit 1 ;;
		esac
	done
	echo "ok   $ref lists: $archs"
done
