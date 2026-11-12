#!/bin/sh
# Build the .deb in a clean Debian container and lint it. Usage:
#   sh scripts/debian-build.sh <output-dir>
# The source tree is mounted read-only and copied inside, so the build leaves
# nothing in the working tree. Needs podman or docker.
set -eu

out=${1:?usage: debian-build.sh <output-dir>}
engine=$(command -v podman || command -v docker) || {
	echo "error: neither podman nor docker is installed" >&2
	exit 1
}
image=${BUILD_IMAGE:-docker.io/library/debian:trixie}
root=$(cd "$(dirname "$0")/.." && pwd)
mkdir -p "$out"
out=$(cd "$out" && pwd)

exec "$engine" run --rm -e DEBIAN_FRONTEND=noninteractive \
	-v "$root:/src:ro" -v "$out:/out" "$image" sh -eu -c '
apt-get update -qq >/dev/null
apt-get install -y -qq --no-install-recommends build-essential debhelper dpkg-dev fakeroot lintian >/dev/null
cp -a /src /build
cd /build
dpkg-buildpackage -us -uc -b
cp /epistle-panel_*_all.deb /out/
lintian --fail-on error,warning /epistle-panel_*_all.deb
'
