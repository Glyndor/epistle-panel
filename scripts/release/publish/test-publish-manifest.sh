#!/usr/bin/env bash
# Tests for scripts/release/publish/publish-manifest.sh. Run from anywhere:
#   bash scripts/release/publish/test-publish-manifest.sh
# `podman` is replaced by a stand-in earlier on PATH that records every call and
# writes the digest file `manifest push --digestfile` would write, so the script
# runs with no registry. What is checked is what the script decides: which tags
# it publishes, what it joins into each, and that it stops when the digests of
# the tags differ or none is written. The real commands are rehearsed against a
# registry by rehearse-manifest.sh in a release dry-run.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../lib/assertions.sh
. "$here/../lib/assertions.sh"
script="$here/publish-manifest.sh"
image=registry.example/panel

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cat > "$tmp/bin/podman" <<'STUB'
#!/usr/bin/env bash
# Stand-in: log the call; for `manifest push`, write the digest the case chose.
echo "$*" >> "$PODMAN_LOG"
if [ "$1 $2" = "manifest push" ]; then
	while [ "$#" -gt 0 ]; do
		if [ "$1" = "--digestfile" ]; then
			case "$STUB_DIGEST_MODE" in
				same) printf 'sha256:aaaa' > "$2" ;;
				differ) printf 'sha256:%s' "$(basename "$2")" > "$2" ;;
				empty) : > "$2" ;;
				none) ;;
			esac
		fi
		shift
	done
fi
STUB
chmod +x "$tmp/bin/podman"

# run_case <digest-mode> <version> -> runs the script in a clean workspace.
run_case() {
	local mode=$1 version=$2
	case_dir=$(mktemp -d "$tmp/case.XXXXXX")
	PODMAN_LOG="$case_dir/log" GITHUB_OUTPUT="$case_dir/output" RUNNER_TEMP="$case_dir" \
		STUB_DIGEST_MODE=$mode PATH="$tmp/bin:$PATH" \
		expect_status "$mode digests, version $version" "${3:-0}" bash "$script" "$image" "$version"
}
export PODMAN_LOG STUB_DIGEST_MODE
PODMAN_LOG=/dev/null STUB_DIGEST_MODE=same

run_case same v0.3.0 0
expect_true "three tags are created" test "$(grep -c '^manifest create' "$case_dir/log")" -eq 3
for tag in 0.3.0 0.3 0; do
	expect_true "tag $tag joins the amd64 image" grep -qxF "manifest add $image:$tag docker://$image:0.3.0-amd64" "$case_dir/log"
	expect_true "tag $tag joins the arm64 image" grep -qxF "manifest add $image:$tag docker://$image:0.3.0-arm64" "$case_dir/log"
	expect_true "tag $tag is pushed with --all" grep -qE "^manifest push --all --digestfile .* $image:$tag\$" "$case_dir/log"
	expect_true "tag $tag is reported in GITHUB_OUTPUT" grep -qxF "$tag" "$case_dir/output"
done
expect_true "the digest goes to GITHUB_OUTPUT" grep -qxF 'digest=sha256:aaaa' "$case_dir/output"

run_case differ 0.3.0 1
expect_output "tags that point at different lists are refused" "differs from"
expect_true "no output is written after a mismatch" test ! -s "$case_dir/output"

run_case empty 0.3.0 1
expect_output "an empty digest file is refused" "no digest was written"
run_case none 0.3.0 1

for bad in v1.0.0-rc.1 v1.02.0 latest; do
	run_case same "$bad" 1
	expect_true "$bad: nothing is created in the registry" test ! -e "$case_dir/log"
done

expect_status "missing arguments are refused" 1 bash "$script"

finish
