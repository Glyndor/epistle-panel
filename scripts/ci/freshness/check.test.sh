#!/usr/bin/env bash
# Tests of scripts/ci/freshness/check.sh with a stand-in `gh` that answers from
# a file: a recent bot pull request passes, an old one fails, none fails, a
# human pull request does not count, a page-3 hit is found and a failed lookup
# fails the check instead of reading as "none".
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"

# The stand-in prints the page named in the URL from $WORK/page<N>.json and
# applies the --jq filter with jq, as the real one does.
cat >"$work/bin/gh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
url="$2"
page="${url##*page=}"
if [ -f "$WORK/fail" ]; then echo "gh: HTTP 500" >&2; exit 1; fi
file="$WORK/page${page}.json"
[ -f "$file" ] || file="$WORK/empty.json"
jq -r "$4" "$file"
STUB
chmod +x "$work/bin/gh"
echo '[]' >"$work/empty.json"

fail=0
days_ago() { date -u -d "$1 days ago" +%Y-%m-%dT%H:%M:%SZ; }
pr() { printf '[{"user":{"login":"%s"},"created_at":"%s"}]' "$1" "$2"; }
verdict() { # expected name
	local status=0
	WORK="$work" PATH="$work/bin:$PATH" REPO=x/y MAX_AGE_DAYS=15 bash "$check" >/dev/null 2>&1 || status=$?
	if { [ "$1" = pass ] && [ "$status" -eq 0 ]; } || { [ "$1" = fail ] && [ "$status" -ne 0 ]; }; then
		echo "ok   $2"
	else
		echo "FAIL $2 (exit $status)"
		fail=1
	fi
}
reset() { rm -f "$work"/page*.json "$work/fail"; }

reset
pr 'dependabot[bot]' "$(days_ago 3)" >"$work/page1.json"
verdict pass "a recent Dependabot pull request passes"

reset
pr 'dependabot[bot]' "$(days_ago 40)" >"$work/page1.json"
verdict fail "an old one fails"

reset
verdict fail "no pull request at all fails"

reset
pr 'Jaro-c' "$(days_ago 1)" >"$work/page1.json"
verdict fail "a human pull request does not count"

reset
pr 'Jaro-c' "$(days_ago 1)" >"$work/page1.json"
pr 'dependabot[bot]' "$(days_ago 2)" >"$work/page3.json"
verdict pass "a hit on the third page is found"

reset
touch "$work/fail"
verdict fail "a failed lookup fails the check"

exit "$fail"
