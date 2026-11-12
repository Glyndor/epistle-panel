# shellcheck shell=bash disable=SC2154,SC2034
# Scenario degraded of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_degraded() {
	echo "# API that hangs or streams a huge body"
	fresh
	login admin correct-horse
	local good=$cookie
	set_mode hang
	( fetch_hang=$(curl -s -o "$work/hang.body" -w '%{http_code} %{time_total}' -b "$good" "$panel/domains"); echo "$fetch_hang" >"$work/hang.result" ) &
	local hang_job=$!
	sleep 1.5
	fetch /login
	assert_between "the server answers while a call hangs" "$elapsed" 0 0.5
	wait "$hang_job"
	read -r status elapsed <"$work/hang.result"
	assert_eq "hanging API: the page still renders" "$status" 200
	assert_between "hanging API: degraded within the 10 s budget" "$elapsed" 9.5 12
	assert_absent "hanging API: no data in the page" "$(cat "$work/hang.body")" "example.test"
	assert_contains "hanging API: the page holds a loading placeholder for the client" "$(cat "$work/hang.body")" 'aria-busy="true"'

	set_mode huge
	local before_rss after_rss
	before_rss=$(rss_kib)
	fetch /domains "$good"
	assert_eq "huge body: the page still renders" "$status" 200
	assert_between "huge body: degraded well inside the budget" "$elapsed" 0 5
	assert_absent "huge body: no data in the page" "$(cat "$work/b")" "example.test"
	assert_eq "huge body: the domains action answers" "$(post_action features/domains/actions/get-domains/index.ts '[]' "$good")" 200
	assert_contains "huge body: the action reports unavailable, with nothing of the error" "$(cat "$work/b")" "unavailable"
	assert_absent "huge body: the action leaks no detail" "$(cat "$work/b")" "ECONN"
	after_rss=$(rss_kib)
	echo "# rss before/after the huge body: ${before_rss} KiB / ${after_rss} KiB"
	if ((after_rss - before_rss < 150 * 1024)); then
		ok "huge body: memory stays bounded"
	else
		not_ok "huge body: memory stays bounded" "grew $((after_rss - before_rss)) KiB"
	fi

	set_mode ok
	fetch /domains "$good"
	assert_contains "the API back: the page recovers" "$(cat "$work/b")" "example.test"
}
