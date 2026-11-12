#!/usr/bin/env bash
# Refuse a release directory that holds anything but the expected files.
#
# Usage: check-files.sh <dist-dir> <tag> <stage>
#
# Stages, each a superset of the one before:
#   built    the .deb and the SBOM, as the build jobs left them
#   signed   the same plus SHA256SUMS
#   final    the same plus one .sig per file, which is what is published
#
# The names are a contract with the apt archive, which downloads
# epistle-panel_<version>_all.deb and its .sig by name, so a file that is not
# on this list is refused before a key is near it or a release is made.
set -euo pipefail

dist=${1:?usage: check-files.sh <dist-dir> <tag> <stage>}
tag=${2:?usage: check-files.sh <dist-dir> <tag> <stage>}
stage=${3:?usage: check-files.sh <dist-dir> <tag> <stage>}
version=${tag#v}

cd "$dist"
if find . -mindepth 1 \( -type l -o ! -type f \) -print -quit | grep -q .; then
	echo "::error::the release files hold something that is not a plain file" >&2
	exit 1
fi

payload=("epistle-panel_${version}_all.deb" "epistle-panel-${tag}.cdx.json")
expected=("${payload[@]}")
case "$stage" in
	built) ;;
	signed) expected+=(SHA256SUMS) ;;
	final)
		expected+=(SHA256SUMS)
		for f in "${payload[@]}" SHA256SUMS; do expected+=("$f.sig"); done
		;;
	*) echo "::error::unknown stage $stage" >&2; exit 2 ;;
esac

found=$(find . -mindepth 1 -maxdepth 1 -printf '%f\n' | sort)
want=$(printf '%s\n' "${expected[@]}" | sort)
if [ "$found" != "$want" ]; then
	echo "::error::the release files are not the expected set for stage $stage" >&2
	printf 'found:\n%s\nexpected:\n%s\n' "$found" "$want" >&2
	exit 1
fi

for f in "${expected[@]}"; do
	[ -s "$f" ] || { echo "::error::$f is empty" >&2; exit 1; }
done

if [ "$stage" != built ]; then
	# SHA256SUMS names exactly the payload, no more and no fewer, and the
	# hashes match the bytes in this directory.
	listed=$(sed -E 's/^[0-9a-f]{64}[ *]+//' SHA256SUMS | sort)
	if [ "$listed" != "$(printf '%s\n' "${payload[@]}" | sort)" ]; then
		echo "::error::SHA256SUMS does not name exactly the published files" >&2
		exit 1
	fi
	sha256sum --check --strict SHA256SUMS
fi
echo "release files ok for stage $stage"
