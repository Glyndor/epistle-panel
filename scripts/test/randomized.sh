#!/usr/bin/env bash
# Run the unit suite in random file and test order, once per seed.
#
# A suite that passes in the default order and fails in another depends on
# shared state: a process-global mock, a store another file leaves filled. The
# required CI check runs the default order only, so this is the local check.
#
#   scripts/test/randomized.sh        # seeds 1 to 10
#   scripts/test/randomized.sh 25     # seeds 1 to 25
#
# A failing seed is printed and replays with `bun test --randomize --seed=N`.
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
	if bun test --randomize --seed="$seed" >/dev/null 2>&1; then
		echo "seed $seed: pass"
	else
		echo "seed $seed: FAIL"
		failed+=("$seed")
	fi
done

if [ "${#failed[@]}" -gt 0 ]; then
	echo "failing seeds: ${failed[*]}" >&2
	echo "replay one with: cd internal && bun test --randomize --seed=${failed[0]}" >&2
	exit 1
fi
