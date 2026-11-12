#!/usr/bin/env bash
# Run the unit suite with coverage and say which number the gate read.
#
# `bun test --coverage` exits 1 below the `coverageThreshold` in
# internal/bunfig.toml and prints nothing about it, so a failing gate and a
# passing one read the same in the log. This wrapper prints the measured lines
# and functions coverage next to the threshold and names the one that failed.
#
#   scripts/test/coverage.sh
set -euo pipefail
export LC_ALL=C

cd "$(dirname "${BASH_SOURCE[0]}")/../../internal"

# The threshold as a percentage, read from the file Bun reads (a fraction).
threshold=$(sed -nE 's/^coverageThreshold = \{ lines = ([0-9.]+),.*/\1/p' bunfig.toml)
if [ -z "$threshold" ]; then
	echo "coverage: no 'coverageThreshold = { lines = ..., functions = ... }' in internal/bunfig.toml" >&2
	exit 2
fi
if ! awk -v t="$threshold" 'BEGIN { exit !(t > 0 && t <= 1) }'; then
	echo "coverage: threshold $threshold is outside 0 to 1; Bun reads it as a fraction (0.9 is 90%)" >&2
	exit 2
fi
percent=$(awk -v t="$threshold" 'BEGIN { printf "%.2f", t * 100 }')

status=0
output=$(bun test --coverage --coverage-reporter=text 2>&1) || status=$?
printf '%s\n' "$output"

# The "All files" row of the text reporter: functions first, then lines.
row=$(printf '%s\n' "$output" | grep -E '^All files' || true)
if [ -z "$row" ]; then
	echo "coverage: bun produced no 'All files' row (exit $status)" >&2
	exit "${status:-1}"
fi
functions=$(printf '%s\n' "$row" | awk -F'|' '{ gsub(/ /, "", $2); print $2 }')
lines=$(printf '%s\n' "$row" | awk -F'|' '{ gsub(/ /, "", $3); print $3 }')

echo "coverage: lines ${lines}%, functions ${functions}%, threshold ${percent}% (bun exit ${status})"

fail=0
for metric in "lines:${lines}" "functions:${functions}"; do
	if awk -v v="${metric#*:}" -v t="$percent" 'BEGIN { exit !(v + 0 < t + 0) }'; then
		echo "coverage: ${metric%%:*} ${metric#*:}% is below the ${percent}% threshold" >&2
		fail=1
	fi
done
if [ "$status" -ne 0 ] && [ "$fail" -eq 0 ]; then
	echo "coverage: bun exited ${status} with coverage above the threshold; a test failed" >&2
fi
exit "$status"
