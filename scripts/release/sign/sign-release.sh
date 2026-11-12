#!/usr/bin/env bash
# Write SHA256SUMS for the release files and sign them with the org Ed25519 key.
#
# Usage: sign-release.sh <dist-dir> <tag>
#
# The key comes from GLYNDOR_RELEASE_ED25519_KEY, never from the command line.
# The signing dependencies go into an isolated virtualenv from the hash-pinned
# requirements, so a system-managed cryptography cannot change what is trusted.
# The apt archive verifies the .deb against <deb>.sig before admitting it and
# refuses to re-sign with its own key anything it did not verify first.
set -euo pipefail

dist=${1:?usage: sign-release.sh <dist-dir> <tag>}
tag=${2:?usage: sign-release.sh <dist-dir> <tag>}
here=$(cd "$(dirname "$0")" && pwd)
version=${tag#v}

if [ -z "${GLYNDOR_RELEASE_ED25519_KEY:-}" ]; then
	echo "::error::no signing key in the environment; refusing to release unsigned artifacts." >&2
	exit 1
fi

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
python3 -m venv "$work/venv"
py="$work/venv/bin/python"
"$py" -m pip install --quiet --require-hashes -r "$here/sign-requirements.txt"

deb="epistle-panel_${version}_all.deb"
sbom="epistle-panel-${tag}.cdx.json"
# SHA256SUMS is written last so that it covers every payload file; its own
# signature is made after it, which is why it does not list itself.
(cd "$dist" && sha256sum -- "$deb" "$sbom" > SHA256SUMS)
for f in "$deb" "$sbom" SHA256SUMS; do
	"$py" "$here/sign_file.py" "$dist/$f"
done
