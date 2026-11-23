#!/usr/bin/env bash
# Tests for scripts/release/publish/promote-tags.sh. Run from anywhere:
#   bash scripts/release/publish/test-promote-tags.sh
# `skopeo` is replaced by a stand-in earlier on PATH that keeps a registry in a folder: one
# file per reference holding the digest it names. What is checked is what the script
# decides: which tags move, that a published version is never given another image, that
# an old version leaves the floating tags alone and that a failure to read is not taken
# for absence.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../lib/assertions.sh
. "$here/../lib/assertions.sh"
script="$here/promote-tags.sh"
image=registry.example/panel
new="sha256:$(printf 'a%.0s' $(seq 64))"
old="sha256:$(printf 'b%.0s' $(seq 64))"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
mkdir "$tmp/bin"
cat > "$tmp/bin/skopeo" <<'STUB'
#!/usr/bin/env bash
# The registry is a folder; a reference is a file name with / and : and @ made safe.
key() { printf '%s' "${1#docker://}" | tr '/:@' '___'; }
case "$1" in
	inspect)
		ref=${*: -1}
		[ "${STUB_MODE:-}" != denied ] || { echo "unauthorized: authentication required" >&2; exit 1; }
		if [ -f "$REG/$(key "$ref")" ]; then cat "$REG/$(key "$ref")"; else echo "manifest unknown" >&2; exit 1; fi ;;
	copy)
		src=${*: -2:1}; dst=${*: -1}
		echo "copy $src $dst" >> "$REG/calls"
		[ -f "$REG/$(key "$src")" ] || { echo "manifest unknown" >&2; exit 1; }
		if [ "${STUB_MODE:-}" = wrongcopy ]; then printf 'sha256:%s' "$(printf 'e%.0s' $(seq 64))" > "$REG/$(key "$dst")"
		else cp "$REG/$(key "$src")" "$REG/$(key "$dst")"; fi ;;
esac
STUB
chmod +x "$tmp/bin/skopeo"

key() { printf '%s' "$1" | tr '/:@' '___'; }
# fresh_registry: the staged list is in the registry and nothing else.
fresh_registry() {
	REG=$(mktemp -d "$tmp/reg.XXXXXX")
	printf '%s' "$new" > "$REG/$(key "$image@$new")"
}
name() { printf '%s' "$1" > "$REG/$(key "$image:$2")"; }
named() { cat "$REG/$(key "$image:$1")" 2>/dev/null || true; }
published() { printf '%s\n' "$@" > "$REG/published"; }
run() { # <version> [mode]
	expect_status "promote $1 (${2:-ok})" "${3:-0}" env REG="$REG" STUB_MODE="${2:-}" PATH="$tmp/bin:$PATH" bash "$script" "$image" "$new" "$1" "$REG/published"
}

fresh_registry; published v0.3.0 v0.2.0
run v0.3.0
expect_true "the exact tag names the staged list" test "$(named 0.3.0)" = "$new"
expect_true "the minor tag names it" test "$(named 0.3)" = "$new"
expect_true "the major tag names it" test "$(named 0)" = "$new"

# Attack: publish a version again, with an image built another time, for a tag that exists.
fresh_registry; published v0.3.0; name "$old" 0.3.0; name "$old" 0.3; name "$old" 0
run v0.3.0 ok 1
expect_output "a published version is refused" "immutable"
expect_true "the exact tag is not replaced" test "$(named 0.3.0)" = "$old"
expect_true "the floating tags do not move either" test "$(named 0.3)" = "$old" -a "$(named 0)" = "$old"
expect_true "nothing was copied" test ! -e "$REG/calls"

# A rerun of a promotion that failed half way: the exact tag is already this list.
fresh_registry; published v0.3.0; name "$new" 0.3.0; name "$old" 0.3
run v0.3.0
expect_true "the floating tag that lagged is moved" test "$(named 0.3)" = "$new"

# Attack: an old patch published late must not take the floating tags back.
fresh_registry; published v0.3.0 v0.3.1; name "$old" 0.3.1; name "$old" 0.3; name "$old" 0
run v0.3.0
expect_true "the exact tag of the old patch is made" test "$(named 0.3.0)" = "$new"
expect_true "the minor tag stays on the newer patch" test "$(named 0.3)" = "$old"
expect_true "the major tag stays on the newer patch" test "$(named 0)" = "$old"
fresh_registry; published v0.2.9 v0.3.0; name "$old" 0.3; name "$old" 0
run v0.2.9
expect_true "an old minor takes its own minor tag" test "$(named 0.2)" = "$new"
expect_true "an old minor leaves the major tag" test "$(named 0)" = "$old"

# A registry that cannot be read is not a registry without the tag.
fresh_registry; published v0.3.0
run v0.3.0 denied 1
expect_true "nothing is made when the registry says anything but 'not there'" test -z "$(named 0.3.0)"

fresh_registry; published v0.3.0
run v0.3.0 wrongcopy 1
expect_output "a tag that does not name the digest after the copy is refused" "after the copy"

# The staged list has to be in the registry.
fresh_registry; published v0.3.0; rm "$REG/$(key "$image@$new")"
run v0.3.0 ok 1
expect_true "nothing is made for a list that is not there" test -z "$(named 0.3.0)"

fresh_registry; published v0.3.0
expect_status "a digest that is a tag is refused" 1 env REG="$REG" PATH="$tmp/bin:$PATH" bash "$script" "$image" 0.3.0-amd64 v0.3.0 "$REG/published"
expect_status "a pre-release is refused" 1 env REG="$REG" PATH="$tmp/bin:$PATH" bash "$script" "$image" "$new" v1.0.0-rc.1 "$REG/published"
expect_status "missing arguments are refused" 1 bash "$script"

finish
