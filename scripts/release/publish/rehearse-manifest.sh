#!/usr/bin/env bash
# Rehearse the manifest publication of a release against a throwaway registry.
#
# Usage: rehearse-manifest.sh <registry-image> <version>
#
# <registry-image> is the registry image, pinned by digest, for example
# docker.io/library/registry@sha256:... It runs as the local registry. Two
# small linux/amd64 and linux/arm64 images are pushed to it as <version>-amd64
# and <version>-arm64, standing in for the two images the release builds.
# publish-manifest.sh then runs unchanged against localhost, so `podman
# manifest create`, `add`, `push --all --digestfile` and the digest agreement
# across tags run before a real release has to depend on them. Nothing leaves
# the machine except the pull of the registry image.
#
# The registry container is removed on exit, by the name this script gave it.
# REHEARSAL_PORT (default 5000) is the host port it listens on.
set -euo pipefail

ref=${1:?usage: rehearse-manifest.sh <registry-image> <version>}
version=${2:?usage: rehearse-manifest.sh <registry-image> <version>}
version=${version#v}
port=${REHEARSAL_PORT:-5000}
here=$(cd "$(dirname "$0")" && pwd)
image="localhost:${port}/epistle-panel"
name="rehearsal-registry-$$"

work=$(mktemp -d)
cleanup() {
	podman rm -f --time 1 "$name" >/dev/null 2>&1 || true
	# The manifest lists publish-manifest.sh created in local storage.
	podman image ls --quiet --filter "reference=${image}" | sort -u | xargs -r podman rmi --force >/dev/null 2>&1 || true
	rm -rf "$work"
}
trap cleanup EXIT

# The registry is plain HTTP on localhost: mark exactly that location as
# insecure for every podman call below, and for the unmodified publish script.
cat > "$work/registries.conf" <<CONF
[[registry]]
location = "localhost:${port}"
insecure = true
CONF
export CONTAINERS_REGISTRIES_CONF="$work/registries.conf"

podman run -d --name "$name" -p "127.0.0.1:${port}:5000" "$ref" >/dev/null
ready=""
for _ in $(seq 1 30); do
	if curl -fsS -o /dev/null "http://127.0.0.1:${port}/v2/"; then
		ready=1
		break
	fi
	sleep 1
done
[ -n "$ready" ] || { echo "::error::the rehearsal registry did not answer" >&2; podman logs "$name" >&2 || true; exit 1; }

# The stand-ins are empty-based images, one per architecture, built without
# running anything in them, so no emulation is needed for arm64. The
# architecture is part of the image config, so the two digests differ.
printf 'rehearsal\n' > "$work/marker"
printf 'FROM scratch\nCOPY marker /marker\n' > "$work/Containerfile"
for arch in amd64 arm64; do
	podman build --quiet --platform "linux/${arch}" -f "$work/Containerfile" \
		-t "${image}:${version}-${arch}" "$work" >/dev/null
	podman push --quiet "${image}:${version}-${arch}"
	podman rmi "${image}:${version}-${arch}" >/dev/null
done

export RUNNER_TEMP="$work"
export GITHUB_OUTPUT="$work/output"
: > "$GITHUB_OUTPUT"
bash "$here/publish-manifest.sh" "$image" "$version"

digest=$(sed -n 's/^digest=//p' "$GITHUB_OUTPUT")
[ -n "$digest" ] || { echo "::error::publish-manifest.sh wrote no digest" >&2; exit 1; }

# What the registry now serves for every tag: one index, the digest the script
# reported, and both architectures in it.
mapfile -t tags < <(python3 -I "$here/image_tags.py" "$version")
for tag in "${tags[@]}"; do
	accept='Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json'
	url="http://127.0.0.1:${port}/v2/epistle-panel/manifests/${tag}"
	served=$(curl -fsSI -H "$accept" "$url" | tr -d '\r' | sed -n 's/^[Dd]ocker-[Cc]ontent-[Dd]igest: //p')
	[ "$served" = "$digest" ] || { echo "::error::tag $tag serves '$served', the script reported '$digest'" >&2; exit 1; }
	archs=$(curl -fsS -H "$accept" "$url" |
		python3 -I -c 'import json,sys; print(" ".join(sorted(m["platform"]["architecture"] for m in json.load(sys.stdin)["manifests"])))')
	[ "$archs" = "amd64 arm64" ] || { echo "::error::tag $tag lists '$archs', expected 'amd64 arm64'" >&2; exit 1; }
done
echo "Rehearsal ok: ${tags[*]} -> $digest"
