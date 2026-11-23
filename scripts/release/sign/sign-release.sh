#!/usr/bin/env bash
# Write SHA256SUMS for the release files, sign them with the org Ed25519 key and check
# every signature against the public key that is pinned in the repository.
#
# Usage: sign-release.sh <dist-dir> <tag> <signer-dir> <public-key-file>
#
# <signer-dir> is the environment prepare-signer.sh made in an earlier step: nothing is
# installed here, so no installer runs with the key in the environment. The key comes
# from GLYNDOR_RELEASE_ED25519_KEY, never from the command line, and only the signer
# reads it. <public-key-file> is the file the signatures are checked against before
# anything leaves this step: the pinned release-verify-key.b64 for a release, the public
# half of the throwaway key for a rehearsal. The apt archive verifies the .deb against
# <deb>.sig before admitting it and refuses to re-sign with its own key anything it did
# not verify first.
set -euo pipefail

dist=${1:?usage: sign-release.sh <dist-dir> <tag> <signer-dir> <public-key-file>}
tag=${2:?usage: sign-release.sh <dist-dir> <tag> <signer-dir> <public-key-file>}
signer=${3:?usage: sign-release.sh <dist-dir> <tag> <signer-dir> <public-key-file>}
pub=${4:?usage: sign-release.sh <dist-dir> <tag> <signer-dir> <public-key-file>}
here=$(cd "$(dirname "$0")" && pwd)
version=${tag#v}

if [ -z "${GLYNDOR_RELEASE_ED25519_KEY:-}" ]; then
	echo "::error::no signing key in the environment; refusing to release unsigned artifacts." >&2
	exit 1
fi
py="$signer/bin/python"
[ -x "$py" ] || { echo "::error::no signer in $signer; prepare-signer.sh runs first" >&2; exit 1; }
[ -f "$pub" ] || { echo "::error::no public key file $pub" >&2; exit 1; }

deb="epistle-panel_${version}_all.deb"
sbom="epistle-panel-${tag}.cdx.json"
# SHA256SUMS is written last so that it covers every payload file; its own
# signature is made after it, which is why it does not list itself.
(cd "$dist" && sha256sum -- "$deb" "$sbom" > SHA256SUMS)
for f in "$deb" "$sbom" SHA256SUMS; do
	"$py" -I "$here/sign_file.py" "$dist/$f"
done
"$py" -I "$here/verify_signatures.py" "$dist" "$tag" "$pub"
