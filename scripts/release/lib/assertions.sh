#!/usr/bin/env bash
# A plain harness for the shell tests of scripts/release. Source it, call
# `expect_status` and `expect_output` for each case, and end the test file with
# `finish`, which exits non-zero when any case failed.
#
# Every case runs a command and compares its exit status. The output is
# compared only where the test says so, so rewording a message cannot break a
# test that is about the exit status.

failures=0
cases=0

# expect_status <name> <expected-status> <command...>
# Run the command and record whether it exited with the expected status. The
# combined output is kept in $last_output for `expect_output`.
expect_status() {
	local name=$1 want=$2
	shift 2
	local got=0
	last_output=$("$@" 2>&1) || got=$?
	cases=$((cases + 1))
	if [ "$got" -eq "$want" ]; then
		echo "ok   $name"
	else
		failures=$((failures + 1))
		echo "FAIL $name: exit $got, expected $want" >&2
		printf '%s\n' "$last_output" | sed 's/^/     | /' >&2
	fi
}

# expect_output <name> <fixed-string>
# Check the output of the last `expect_status` for a fixed string.
expect_output() {
	local name=$1 want=$2
	cases=$((cases + 1))
	if printf '%s' "$last_output" | grep -qF -- "$want"; then
		echo "ok   $name"
	else
		failures=$((failures + 1))
		echo "FAIL $name: output has no '$want'" >&2
		printf '%s\n' "$last_output" | sed 's/^/     | /' >&2
	fi
}

# expect_true <name> <command...>
# Record whether a command succeeds.
expect_true() {
	local name=$1
	shift
	cases=$((cases + 1))
	if "$@"; then
		echo "ok   $name"
	else
		failures=$((failures + 1))
		echo "FAIL $name" >&2
	fi
}

finish() {
	echo "$((cases - failures))/$cases passed"
	[ "$failures" -eq 0 ]
}
