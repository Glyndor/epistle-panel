#!/usr/bin/env bash
# Tests for scripts/release/publish/publish-manifest.sh. Run from anywhere:
#   bash scripts/release/publish/test-publish-manifest.sh
# `podman` is replaced by a stand-in earlier on PATH that records every call, answers
# `manifest inspect` with the index the case chose and writes the digest file that
# `manifest push --digestfile` would write, so the script runs with no registry. What is
# checked is what the script decides: that the members are named by digest, that the list
# it read back is the one asked for, and that nothing is pushed when it is not. The real
# commands are rehearsed against a registry by rehearse-manifest.sh in a release dry-run.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../lib/assertions.sh
. "$here/../lib/assertions.sh"
script="$here/publish-manifest.sh"
image=registry.example/panel
stage=ci-123-1
amd="sha256:$(printf 'a%.0s' $(seq 64))"
arm="sha256:$(printf 'b%.0s' $(seq 64))"
other="sha256:$(printf 'c%.0s' $(seq 64))"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cat > "$tmp/bin/podman" <<'STUB'
#!/usr/bin/env bash
echo "$*" >> "$PODMAN_LOG"
case "$1 $2" in
	"manifest inspect")
		case "$STUB_INDEX" in
			ok) printf '{"manifests":[{"digest":"%s","platform":{"architecture":"amd64"}},{"digest":"%s","platform":{"architecture":"arm64"}}]}' "$STUB_AMD" "$STUB_ARM" ;;
			swapped) printf '{"manifests":[{"digest":"%s","platform":{"architecture":"amd64"}},{"digest":"%s","platform":{"architecture":"arm64"}}]}' "$STUB_ARM" "$STUB_AMD" ;;
			substituted) printf '{"manifests":[{"digest":"%s","platform":{"architecture":"amd64"}},{"digest":"%s","platform":{"architecture":"arm64"}}]}' "$STUB_AMD" "$STUB_OTHER" ;;
			extra) printf '{"manifests":[{"digest":"%s","platform":{"architecture":"amd64"}},{"digest":"%s","platform":{"architecture":"arm64"}},{"digest":"%s","platform":{"architecture":"s390x"}}]}' "$STUB_AMD" "$STUB_ARM" "$STUB_OTHER" ;;
			twice) printf '{"manifests":[{"digest":"%s","platform":{"architecture":"amd64"}},{"digest":"%s","platform":{"architecture":"amd64"}}]}' "$STUB_AMD" "$STUB_ARM" ;;
			none) printf '{}' ;;
		esac ;;
	"manifest push")
		while [ "$#" -gt 0 ]; do
			if [ "$1" = "--digestfile" ]; then
				case "$STUB_DIGEST" in
					good) printf 'sha256:%s' "$(printf 'd%.0s' $(seq 64))" > "$2" ;;
					empty) : > "$2" ;;
					short) printf 'sha256:dddd' > "$2" ;;
					none) ;;
				esac
			fi
			shift
		done ;;
esac
STUB
chmod +x "$tmp/bin/podman"

# run_case <index-mode> <digest-mode> <status> [args...] -> runs the script in a clean workspace.
run_case() {
	local index=$1 digest=$2 want=$3
	shift 3
	case_dir=$(mktemp -d "$tmp/case.XXXXXX")
	PODMAN_LOG="$case_dir/log" GITHUB_OUTPUT="$case_dir/output" STUB_INDEX=$index STUB_DIGEST=$digest \
		STUB_AMD=$amd STUB_ARM=$arm STUB_OTHER=$other PATH="$tmp/bin:$PATH" \
		expect_status "index $index, digest $digest ($*)" "$want" bash "$script" "$@"
}

run_case ok good 0 "$image" "$stage" "$amd" "$arm"
expect_true "the staged tag is reported" grep -qxF "stage=$stage" "$case_dir/output"
expect_true "the digest the push wrote is reported" grep -qxE 'digest=sha256:d{64}' "$case_dir/output"
expect_true "the amd64 image joins by digest" grep -qxF "manifest add $image:$stage docker://$image@$amd" "$case_dir/log"
expect_true "the arm64 image joins by digest" grep -qxF "manifest add $image:$stage docker://$image@$arm" "$case_dir/log"
expect_true "no member is named by a tag" test "$(grep -c '^manifest add' "$case_dir/log")" -eq "$(grep -c '^manifest add .* docker://[^ ]*@sha256:[0-9a-f]\{64\}$' "$case_dir/log")"
expect_true "no public tag is made here" test "$(grep -c '^manifest create' "$case_dir/log")" -eq 1
expect_true "the list is pushed with --all" grep -qE "^manifest push --all --digestfile .* $image:$stage\$" "$case_dir/log"

# Attack: someone with write access to the package replaces what is behind a name between the
# push of the image and the join. The members are digests, so what the registry serves for a
# name does not matter; and a list that reads back with another member is refused before it
# is pushed.
for mode in swapped substituted extra twice none; do
	run_case "$mode" good 1 "$image" "$stage" "$amd" "$arm"
	expect_output "a list that reads back as '$mode' is refused" "::error::"
	expect_true "'$mode': nothing is pushed" test "$(grep -c '^manifest push' "$case_dir/log")" -eq 0
	expect_true "'$mode': nothing is reported" test ! -s "$case_dir/output"
done

run_case ok empty 1 "$image" "$stage" "$amd" "$arm"
expect_output "an empty digest file is refused" "no digest was written"
run_case ok short 1 "$image" "$stage" "$amd" "$arm"
run_case ok none 1 "$image" "$stage" "$amd" "$arm"

# A tag, a short digest or an upper case one is not a digest: nothing reaches the registry.
for bad in 0.3.0-amd64 latest sha256:abc "sha256:$(printf 'A%.0s' $(seq 64))" ""; do
	run_case ok good 1 "$image" "$stage" "$bad" "$arm"
	expect_true "'$bad' as a member: nothing is created" test ! -e "$case_dir/log"
done
run_case ok good 1 "$image" "$stage" "$amd" "$amd"
expect_true "the same image twice: nothing is created" test ! -e "$case_dir/log"
for bad in "" "-x" "a b" "../x"; do
	run_case ok good 1 "$image" "$bad" "$amd" "$arm"
	expect_true "'$bad' as a staging tag: nothing is created" test ! -e "$case_dir/log"
done

expect_status "missing arguments are refused" 1 bash "$script"

finish
