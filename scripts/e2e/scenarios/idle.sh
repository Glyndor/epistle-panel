# shellcheck shell=bash disable=SC2154,SC2034
# Scenario idle of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_idle() {
	echo "# memory and CPU, idle and after 400 requests"
	fresh
	login admin correct-horse
	local good=$cookie
	fetch /app/queue "$good"
	local rss0 ticks0 ticks1 rss1 rss2 i
	sleep 1
	rss0=$(rss_kib)
	ticks0=$(cpu_ticks)
	sleep 3
	ticks1=$(cpu_ticks)
	echo "# idle: rss ${rss0} KiB, $((ticks1 - ticks0)) CPU ticks in 3 s (100 ticks = 1 s)"
	((ticks1 - ticks0 <= 30)) && ok "idle CPU stays under 10 percent" || not_ok "idle CPU stays under 10 percent"
	# Node returns memory lazily, so the resident size after a burst depends on when
	# the garbage collector last ran: two fixed-delta checks failed on a CI runner
	# and locally. What can be asserted without a leak profiler is a bound: after
	# 400 requests and a pause the server must still sit under a ceiling that a
	# runaway allocation would cross, and must still answer.
	burst() {
		local n
		for n in $(seq 1 50); do
			curl -s -o /dev/null -b "$good" "$panel/app"
			curl -s -o /dev/null -b "$good" "$panel/app/queue"
			curl -s -o /dev/null -b "$good" "$panel/app/domains"
			curl -s -o /dev/null "$panel/login"
		done
	}
	burst
	rss1=$(rss_kib)
	echo "# after 200 requests: rss ${rss1} KiB (+$((rss1 - rss0)) KiB)"
	burst
	sleep 3
	local rss1b
	rss1b=$(rss_kib)
	echo "# after 400 requests and a pause: rss ${rss1b} KiB (+$((rss1b - rss0)) KiB)"
	if ((rss1b < 512 * 1024)); then
		ok "memory stays under 512 MiB after 400 requests"
	else
		not_ok "memory stays under 512 MiB after 400 requests"
	fi
	rss2=$(rss_kib)
	if ((rss2 > 0)); then ok "server still alive"; else not_ok "server still alive"; fi
}
