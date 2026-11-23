#!/usr/bin/env bash
# Tests for scripts/release/verify/check-files.sh. Run from anywhere:
#   bash scripts/release/verify/test-check-files.sh
# Each case builds a release directory in a temporary folder and checks the exit
# status of the script for one stage.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../lib/assertions.sh
. "$here/../lib/assertions.sh"
script="$here/check-files.sh"
tag=v0.3.0
deb=epistle-panel_0.3.0_all.deb
sbom=epistle-panel-v0.3.0.cdx.json

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT

# fresh <stage> -> a directory holding exactly the files of that stage.
fresh() {
	local stage=$1 dir
	dir=$(mktemp -d "$tmp/dist.XXXXXX")
	printf 'deb\n' > "$dir/$deb"
	printf '{}\n' > "$dir/$sbom"
	if [ "$stage" != built ]; then
		(cd "$dir" && sha256sum -- "$deb" "$sbom" > SHA256SUMS)
	fi
	if [ "$stage" = final ]; then
		for f in "$deb" "$sbom" SHA256SUMS; do printf 'sig\n' > "$dir/$f.sig"; done
	fi
	echo "$dir"
}

for stage in built signed final; do
	expect_status "$stage: the expected files pass" 0 bash "$script" "$(fresh "$stage")" "$tag" "$stage"
done

d=$(fresh built); printf 'x' > "$d/extra.txt"
expect_status "built: an extra file is refused" 1 bash "$script" "$d" "$tag" built
d=$(fresh built); rm "$d/$sbom"
expect_status "built: a missing file is refused" 1 bash "$script" "$d" "$tag" built
d=$(fresh built); : > "$d/$deb"
expect_status "built: an empty file is refused" 1 bash "$script" "$d" "$tag" built
d=$(fresh built); ln -s "$deb" "$d/link"
expect_status "built: a symlink is refused" 1 bash "$script" "$d" "$tag" built
d=$(fresh built); mkdir "$d/sub"
expect_status "built: a directory is refused" 1 bash "$script" "$d" "$tag" built
d=$(fresh built); rm "$d/$deb"; ln -s "$sbom" "$d/$deb"
expect_status "built: a symlink in place of a payload file is refused" 1 bash "$script" "$d" "$tag" built
d=$(fresh built)
expect_status "built: a file for another version is refused" 1 bash "$script" "$d" v0.4.0 built

d=$(fresh built)
expect_status "signed: a stage that needs SHA256SUMS refuses its absence" 1 bash "$script" "$d" "$tag" signed
d=$(fresh signed); printf 'tampered\n' > "$d/$deb"
expect_status "signed: bytes that no longer match SHA256SUMS are refused" 1 bash "$script" "$d" "$tag" signed
d=$(fresh signed); sed -i '1d' "$d/SHA256SUMS"
expect_status "signed: SHA256SUMS that omits a payload file is refused" 1 bash "$script" "$d" "$tag" signed
d=$(fresh signed); printf '%s  extra\n' "$(printf 'x' | sha256sum | cut -d' ' -f1)" >> "$d/SHA256SUMS"
expect_status "signed: SHA256SUMS that names an extra file is refused" 1 bash "$script" "$d" "$tag" signed

d=$(fresh final); rm "$d/SHA256SUMS.sig"
expect_status "final: a missing signature is refused" 1 bash "$script" "$d" "$tag" final
d=$(fresh final); printf 'tampered\n' > "$d/$sbom"
expect_status "final: bytes that no longer match SHA256SUMS are refused" 1 bash "$script" "$d" "$tag" final
d=$(fresh final); : > "$d/$deb.sig"
expect_status "final: an empty signature is refused" 1 bash "$script" "$d" "$tag" final

expect_status "an unknown stage is refused" 2 bash "$script" "$(fresh built)" "$tag" published
expect_status "missing arguments are refused" 1 bash "$script"

# One artifact in a folder of its own: each folder holds its files and nothing else, so an
# artifact that arrives with the payload of another one is refused before the folders are
# put together.
alone() { # <stage> -> a folder with the files of that artifact
	local stage=$1 dir
	dir=$(mktemp -d "$tmp/alone.XXXXXX")
	case "$stage" in
		deb) printf 'deb\n' > "$dir/$deb" ;;
		sbom) printf '{}\n' > "$dir/$sbom" ;;
		signatures)
			printf 'sums\n' > "$dir/SHA256SUMS"
			for f in "$deb" "$sbom" SHA256SUMS; do printf 'sig\n' > "$dir/$f.sig"; done ;;
	esac
	echo "$dir"
}
for stage in deb sbom signatures; do
	expect_status "$stage: the folder of the artifact passes" 0 bash "$script" "$(alone "$stage")" "$tag" "$stage"
	d=$(alone "$stage"); printf 'x' > "$d/extra.txt"
	expect_status "$stage: an extra file is refused" 1 bash "$script" "$d" "$tag" "$stage"
done
# Attack: a signatures artifact that carries the payload too, to overwrite the package when
# the folders are put together.
d=$(alone signatures); printf 'other deb\n' > "$d/$deb"
expect_status "signatures: a package inside the signatures is refused" 1 bash "$script" "$d" "$tag" signatures
d=$(alone deb); printf 'sums\n' > "$d/SHA256SUMS"
expect_status "deb: checksums inside the package artifact are refused" 1 bash "$script" "$d" "$tag" deb
d=$(alone signatures); rm "$d/$sbom.sig"
expect_status "signatures: a missing signature is refused" 1 bash "$script" "$d" "$tag" signatures
d=$(alone signatures); : > "$d/$deb.sig"
expect_status "signatures: an empty signature is refused" 1 bash "$script" "$d" "$tag" signatures

finish
