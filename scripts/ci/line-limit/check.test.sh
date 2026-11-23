#!/usr/bin/env bash
# Tests of scripts/ci/line-limit/check.sh in a throwaway repository: a file at
# the limit passes, one line more fails, blank and comment lines do not count,
# a hash comment counts in TypeScript and not in shell, a vendored file is
# skipped, and a repository with nothing to read fails instead of passing.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fail=0
verdict() { # expected name [env...]
	local expected="$1" name="$2" status=0
	shift 2
	(cd "$work/r" && env "$@" bash "$check" >/dev/null 2>&1) || status=$?
	if { [ "$expected" = pass ] && [ "$status" -eq 0 ]; } || { [ "$expected" = fail ] && [ "$status" -ne 0 ]; }; then
		echo "ok   $name"
	else
		echo "FAIL $name (exit $status)"
		fail=1
	fi
}
fresh() {
	rm -rf "$work/r"
	git init -q -b main "$work/r"
	cd "$work/r"
}
lines() { awk -v n="$1" -v t="$2" 'BEGIN { for (i = 0; i < n; i++) print t " " i }'; }
track() {
	git add -A
	git -c user.name=t -c user.email=t@example.invalid commit -q -m x --no-gpg-sign
}

fresh
lines 10 "const a =" >a.ts
track
verdict pass "a file at the limit passes" HARD=10 SOFT=5
lines 11 "const a =" >a.ts
track
verdict fail "one line over the hard limit fails" HARD=10 SOFT=5

fresh
{ lines 10 "const a ="; for _ in 1 2 3 4 5; do echo; echo "// a comment"; echo "  * a doc line"; done; } >a.ts
track
verdict pass "blank and comment lines do not count" HARD=10 SOFT=5

fresh
{ lines 5 "const a ="; lines 6 "# not a comment in TypeScript"; } >a.ts
track
verdict fail "a hash line counts in TypeScript" HARD=10 SOFT=5

fresh
{ lines 5 "echo"; lines 6 "# a comment in shell"; } >a.sh
track
verdict pass "a hash line does not count in shell" HARD=10 SOFT=5

fresh
mkdir vendor && lines 50 "x =" >vendor/big.ts
lines 3 "ok =" >a.ts
track
verdict pass "a vendored file is skipped" HARD=10 SOFT=5

fresh
lines 50 "x =" >big.css
track
verdict fail "nothing matching the extensions is a failure, not a pass" HARD=10 SOFT=5

fresh
lines 3 "ok =" >a.ts
track
verdict fail "a non-numeric limit is refused" HARD=ten SOFT=5

exit "$fail"
