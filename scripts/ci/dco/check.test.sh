#!/usr/bin/env bash
# Tests of scripts/ci/dco/check.sh in throwaway repositories: a signed range
# passes; an unsigned commit, a forged trailer in the body, an evil merge, an
# octopus merge and a missing variable each fail.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fail=0
pass() { echo "ok   $1"; }
bad() {
	echo "FAIL $1"
	fail=1
}

new_repo() {
	rm -rf "$work/r"
	git init -q -b main "$work/r"
	cd "$work/r"
	git config user.name "Test"
	git config user.email "test@example.invalid"
	git config commit.gpgsign false
	echo base >base.txt
	git add base.txt
	git commit -q -s -m "chore: base"
	BASE="$(git rev-parse HEAD)"
}

# run_check <expected: pass|fail> <name>
run_check() {
	local expected="$1" name="$2" out status=0
	out="$(BASE_SHA="$BASE" HEAD_SHA="$(git rev-parse HEAD)" bash "$check" 2>&1)" || status=$?
	if [ "$expected" = pass ] && [ "$status" -eq 0 ]; then
		pass "$name"
	elif [ "$expected" = fail ] && [ "$status" -ne 0 ]; then
		pass "$name"
	else
		bad "$name (exit $status)"
		printf '%s\n' "$out"
	fi
}

new_repo
echo a >a.txt && git add a.txt && git commit -q -s -m "feat: a"
run_check pass "every commit is signed"

new_repo
echo a >a.txt && git add a.txt && git commit -q -m "feat: a"
run_check fail "an unsigned commit fails"

new_repo
echo a >a.txt && git add a.txt
git commit -q -m "feat: a" -m "Signed-off-by-not: someone"
run_check fail "a lookalike trailer is not a sign-off"

new_repo
echo a >a.txt && git add a.txt && git commit -q -s -m "feat: a"
git checkout -q -b side "$BASE"
echo b >b.txt && git add b.txt && git commit -q -s -m "feat: b"
git checkout -q main
git merge -q --no-ff -s ort -m "merge side" side
run_check pass "a clean merge of two signed branches passes"

new_repo
echo a >a.txt && git add a.txt && git commit -q -s -m "feat: a"
git checkout -q -b side "$BASE"
echo b >b.txt && git add b.txt && git commit -q -s -m "feat: b"
git checkout -q main
git merge -q --no-ff --no-commit side
echo smuggled >smuggled.txt && git add smuggled.txt
git commit -q -m "merge side"
run_check fail "an evil merge fails"

new_repo
echo a >a.txt && git add a.txt && git commit -q -s -m "feat: a"
git checkout -q -b s1 "$BASE" && echo b >b.txt && git add b.txt && git commit -q -s -m "feat: b"
git checkout -q -b s2 "$BASE" && echo c >c.txt && git add c.txt && git commit -q -s -m "feat: c"
git checkout -q main
git merge -q --no-ff -m "octopus" s1 s2
run_check fail "an octopus merge fails"

new_repo
echo a >a.txt && git add a.txt && git commit -q -s -m "feat: a"
if BASE_SHA="" HEAD_SHA="$(git rev-parse HEAD)" bash "$check" >/dev/null 2>&1; then
	bad "an empty BASE_SHA fails"
else
	pass "an empty BASE_SHA fails"
fi
if BASE_SHA="$BASE" HEAD_SHA="0000000000000000000000000000000000000001" bash "$check" >/dev/null 2>&1; then
	bad "an unknown head fails closed"
else
	pass "an unknown head fails closed"
fi

exit "$fail"
