#!/usr/bin/env bash
# Run the unit suite in random file and test order, once per seed.
#
# A suite that passes in the default order and fails in another depends on
# shared state: a process-global mock, a store another file leaves filled. The
# required CI check runs the default order only; the `Randomized tests`
# workflow runs seed 1 on a pull request, and this runs more of them locally.
#
#   scripts/test/randomized.sh        # seeds 1 to 10
#   scripts/test/randomized.sh 25     # seeds 1 to 25
#   scripts/test/randomized.sh 1      # seed 1 only, what the workflow runs
#
# A failing seed is printed with the tail of its output and replays with
# `bun test --randomize --seed=N`.
set -euo pipefail

count="${1:-10}"
case "$count" in
'' | *[!0-9]* | 0)
	echo "usage: $0 [number of seeds]" >&2
	exit 2
	;;
esac

cd "$(dirname "${BASH_SOURCE[0]}")/../../internal"

failed=()
for seed in $(seq 1 "$count"); do
	if output=$(bun test --randomize --seed="$seed" 2>&1); then
		echo "seed $seed: pass"
	else
		echo "seed $seed: FAIL"
		printf '%s\n' "$output" | tail -n 40 >&2
		failed+=("$seed")
	fi
done

if [ "${#failed[@]}" -gt 0 ]; then
	echo "failing seeds: ${failed[*]}" >&2
	echo "replay one with: cd internal && bun test --randomize --seed=${failed[0]}" >&2
	exit 1
fi
