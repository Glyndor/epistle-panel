#!/bin/sh
# Install the built .deb in a clean Debian container and check what it leaves
# behind. Usage: sh scripts/debian-smoke.sh <path-to-.deb>
# Needs podman or docker. The package's dependencies on epistle, podup and
# glyndor-archive-keyring are not in Debian, so the .deb is installed with
# dpkg --force-depends; what is checked is this package's own footprint.
set -eu

deb=${1:?usage: debian-smoke.sh <path-to-.deb>}
engine=$(command -v podman || command -v docker) || {
	echo "error: neither podman nor docker is installed" >&2
	exit 1
}
image=${SMOKE_IMAGE:-docker.io/library/debian:trixie}
root=$(cd "$(dirname "$0")/.." && pwd)

exec "$engine" run --rm \
	-v "$(cd "$(dirname "$deb")" && pwd)/$(basename "$deb"):/pkg/epistle-panel.deb:ro" \
	-v "$root/scripts/debian-smoke-inner.sh:/pkg/inner.sh:ro" \
	"$image" sh /pkg/inner.sh
