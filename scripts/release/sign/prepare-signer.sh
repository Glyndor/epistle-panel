#!/usr/bin/env bash
# Make the environment the signer runs in, from the hash-pinned requirements, in a
# directory of its own and without any secret.
#
# Usage: prepare-signer.sh <signer-dir>
#
# This is the only step that reaches the package index. It refuses to run when the
# signing key is in the environment, so a dependency, its build step or pip itself
# never sees it: the key is handed to the signing step alone, after this one. Only
# wheels are installed and none of their dependencies is resolved, so nothing is
# built or run from source and the pinned file names every package that is installed.
set -euo pipefail

dir=${1:?usage: prepare-signer.sh <signer-dir>}
here=$(cd "$(dirname "$0")" && pwd)

if [ -n "${GLYNDOR_RELEASE_ED25519_KEY:-}" ]; then
	echo "::error::the signing key is in the environment of the step that installs the signer; refusing" >&2
	exit 1
fi
if [ -e "$dir" ]; then
	echo "::error::$dir exists; the signer is made in a directory of its own" >&2
	exit 1
fi

python3 -m venv "$dir"
"$dir/bin/python" -I -m pip install --quiet --only-binary=:all: --no-deps --require-hashes \
	-r "$here/sign-requirements.txt"
