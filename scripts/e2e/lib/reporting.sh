# shellcheck shell=bash disable=SC2154,SC2034
# Pass/fail counters and the assert_* helpers of the end-to-end checks.
# Sourced by scripts/e2e/run.sh, which defines the variables it reads.

ok() {
	passed=$((passed + 1))
	echo "ok - $1"
}

not_ok() {
	failed=$((failed + 1))
	echo "not ok - $1"
	[[ -n "${2:-}" ]] && echo "    $2"
	return 0
}

# assert_eq DESCRIPTION ACTUAL EXPECTED
assert_eq() {
	if [[ "$2" == "$3" ]]; then
		ok "$1 ($2)"
	else
		not_ok "$1" "expected '$3', got '$2'"
	fi
}

# assert_contains DESCRIPTION HAYSTACK NEEDLE
assert_contains() {
	if [[ "$2" == *"$3"* ]]; then
		ok "$1"
	else
		not_ok "$1" "'$3' not found"
	fi
}

# assert_absent DESCRIPTION HAYSTACK NEEDLE
assert_absent() {
	if [[ "$2" != *"$3"* ]]; then
		ok "$1"
	else
		not_ok "$1" "'$3' found"
	fi
}

# assert_between DESCRIPTION VALUE LOW HIGH (decimal seconds)
assert_between() {
	if awk -v v="$2" -v lo="$3" -v hi="$4" 'BEGIN { exit !(v >= lo && v <= hi) }'; then
		ok "$1 (${2}s, expected ${3}s to ${4}s)"
	else
		not_ok "$1" "${2}s is outside ${3}s to ${4}s"
	fi
}
