# shellcheck shell=bash disable=SC2154,SC2034
# Scenario idle of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_idle() {
	echo "# memory and CPU, idle and after 400 requests"
	fresh
	login admin correct-horse
	local good=$cookie
	fetch "$adm/queue" "$good"
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
			curl -s -o /dev/null -b "$good" "$panel$adm"
			curl -s -o /dev/null -b "$good" "$panel$adm/queue"
			curl -s -o /dev/null -b "$good" "$panel$adm/domains"
			curl -s -o /dev/null "$panel/"
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
	# The first 400 requests warm the heap up: V8 and Next fill their caches and
	# keep the memory, so the size after them sits around 500 MiB on a runner. A
	# leak keeps growing and a warm-up does not, so the check is a roof that a
	# runaway allocation would cross, and the growth of a further 400 requests,
	# which has to be small. (The check found a real leak: a five-minute timer
	# per prefetched query kept every request alive on the server, about 55 MB of
	# heap per 200 requests; the server's query client no longer collects by timer.)
	if ((rss1b < 768 * 1024)); then
		ok "memory stays under 768 MiB after 400 requests"
	else
		not_ok "memory stays under 768 MiB after 400 requests"
	fi
	burst
	sleep 3
	local rss1c
	rss1c=$(rss_kib)
	echo "# after 800 requests and a pause: rss ${rss1c} KiB (+$((rss1c - rss1b)) KiB over the second burst)"
	if ((rss1c - rss1b < 96 * 1024)); then
		ok "memory stops growing: under 96 MiB more over the next 400 requests"
	else
		not_ok "memory stops growing: under 96 MiB more over the next 400 requests"
	fi
	rss2=$(rss_kib)
	if ((rss2 > 0)); then ok "server still alive"; else not_ok "server still alive"; fi
}
