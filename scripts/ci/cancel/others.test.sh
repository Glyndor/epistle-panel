#!/usr/bin/env bash
# Tests of scripts/ci/cancel/others.sh with a stand-in `gh` that serves a fixed
# list of runs and records what it was asked to cancel. The stand-in ignores the
# filters it is given, so the script has to apply its own: that is what is tested.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
script="$here/others.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir "$work/bin"

cat >"$work/bin/gh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
case "$1 $2" in
"run list")
	[ -f "$WORK/list-fails" ] && exit 1
	cat "$WORK/runs.json"
	;;
"run cancel")
	[ -f "$WORK/cancel-fails" ] && exit 1
	echo "$3" >>"$WORK/cancelled"
	;;
esac
STUB
chmod +x "$work/bin/gh"

fail=0
SHA=abc
BRANCH=feature
run() { WORK="$work" PATH="$work/bin:$PATH" REPO=x/y SHA="$SHA" BRANCH="$BRANCH" SELF=2 bash "$script" >/dev/null 2>&1; }
cancelled() { { sort "$work/cancelled" 2>/dev/null || true; } | tr '\n' ' '; }
check() { # name wanted
	local got
	got="$(cancelled)"
	if [ "$got" = "$2" ]; then echo "ok   $1"; else
		echo "FAIL $1: cancelled '$got', wanted '$2'"
		fail=1
	fi
}
reset() { rm -f "$work/cancelled" "$work/list-fails" "$work/cancel-fails"; }
# run <id> <status> <workflow> <event> <branch> <sha>
r() { printf '{"databaseId":%s,"status":"%s","workflowName":"%s","event":"%s","headBranch":"%s","headSha":"%s"}' "$1" "$2" "$3" "$4" "$5" "$6"; }
runs() { local IFS=,; echo "[$*]" >"$work/runs.json"; }

reset
runs "$(r 1 in_progress CodeQL pull_request feature abc)" \
	"$(r 2 in_progress CI pull_request feature abc)" \
	"$(r 3 queued DCO pull_request feature abc)" \
	"$(r 4 completed CodeQL pull_request feature abc)" \
	"$(r 5 waiting 'Folder limit' pull_request feature abc)"
run
check "the going runs of the list are cancelled, a finished one and itself are not" "1 3 5 "

reset
runs "$(r 1 in_progress CodeQL push feature abc)" "$(r 2 in_progress CodeQL merge_group feature abc)" \
	"$(r 3 in_progress CodeQL schedule feature abc)" "$(r 4 in_progress CodeQL workflow_dispatch feature abc)"
run
check "a run of push, merge_group, schedule or workflow_dispatch of the same commit is not cancelled" ""

reset
runs "$(r 1 in_progress Release push feature abc)" "$(r 2 in_progress Release workflow_dispatch feature abc)" \
	"$(r 3 in_progress Release pull_request feature abc)" "$(r 4 in_progress guard pull_request feature abc)"
run
check "a release run, or any workflow off the list, is not cancelled even for a pull request" ""

reset
runs "$(r 1 in_progress CodeQL pull_request other abc)" "$(r 2 in_progress CodeQL pull_request feature def)"
run
check "another branch or another commit is not cancelled" ""

reset
runs "$(r 2 in_progress CodeQL pull_request feature abc)"
run
check "the run itself is not cancelled, even if listed and on the list" ""

reset
touch "$work/list-fails"
if run; then echo "ok   a failed listing is not an error"; else
	echo "FAIL a failed listing fails the script"
	fail=1
fi
check "a failed listing cancels nothing" ""

reset
echo 'not json' >"$work/runs.json"
if run; then echo "ok   an unreadable listing is not an error"; else
	echo "FAIL an unreadable listing fails the script"
	fail=1
fi
check "an unreadable listing cancels nothing" ""

reset
runs "$(r 1 in_progress CodeQL pull_request feature abc)"
touch "$work/cancel-fails"
if run; then echo "ok   a refused cancel is not an error"; else
	echo "FAIL a refused cancel fails the script"
	fail=1
fi

for var in SHA BRANCH; do
	if env -u "$var" WORK="$work" PATH="$work/bin:$PATH" REPO=x/y SHA=abc BRANCH=feature SELF=2 "$var=" bash "$script" >/dev/null 2>&1; then
		echo "FAIL an empty $var must fail"
		fail=1
	else echo "ok   an empty $var fails"; fi
done

exit "$fail"
