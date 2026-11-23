#!/usr/bin/env bash
# Attack test of the credential scan, for this repository: a branch with its own root
# commit, merged, whose root adds a token and whose second commit takes it out. The merge
# leaves nothing of the token in the tree, so a scan of the net diff finds nothing; the
# token is in the history of the branch all the same, and history cannot be taken back.
# The first commit of such a branch has no parent, and a scan that walks each commit against
# its parents skips it. Run from anywhere:
#   bash scripts/ci/hygiene/root-commit.test.sh
set -uo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SCRIPT="$HERE/check-secrets.sh"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
pass=0; fail=0

check() { # <description> <want> <got>
	if [ "$2" = "$3" ]; then pass=$((pass + 1)); echo "ok    $1"
	else fail=$((fail + 1)); echo "FAIL  $1 (want '$2', got '$3')"; fi
}

# The token is assembled here so that this file does not hold one.
token="AKIA""ABCDEFGHIJKLMNOP"

g() { git -C "$WORK/repo" -c user.name=t -c user.email=1+t@users.noreply.github.com -c commit.gpgSign=false "$@"; }

# case <name> <value of the file in the root commit>: builds main, an orphan branch whose
# root holds the value and whose second commit removes the file, and merges it.
build() {
	rm -rf "$WORK/repo"
	git init -q -b main "$WORK/repo"
	printf 'one\n' > "$WORK/repo/a.txt"
	g add -A; g commit -q -m "main one"
	base="$(g rev-parse HEAD)"
	g checkout -q --orphan side
	g rm -rfq . >/dev/null 2>&1 || true
	printf 'key = %s\n' "$1" > "$WORK/repo/side.txt"
	g add -A; g commit -q -m "side root"
	g rm -q side.txt; printf 'clean\n' > "$WORK/repo/side.txt"; g add -A; g commit -q -m "side two"
	g checkout -q main
	g merge -q --allow-unrelated-histories --no-ff -m "merge side" side
	head="$(g rev-parse HEAD)"
}

build "$token"
tree_has="$(g grep -c "$token" "$head" -- 2>/dev/null | wc -l | tr -d ' ')"
check "the merged tree holds no token" 0 "$tree_has"
out="$(cd "$WORK/repo" && bash "$SCRIPT" "$base" "$head" 2>&1)"; status=$?
check "a token that only the root commit of a merged branch added is refused" 1 "$status"
case "$out" in *"AWS access key"*) named=yes ;; *) named=no ;; esac
check "the pattern is named" yes "$named"
case "$out" in *"$token"*) leaked=yes ;; *) leaked=no ;; esac
check "the value is never printed" no "$leaked"

build "nothing to see"
(cd "$WORK/repo" && bash "$SCRIPT" "$base" "$head" >/dev/null 2>&1); status=$?
check "the same shape with a harmless root passes" 0 "$status"

echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
