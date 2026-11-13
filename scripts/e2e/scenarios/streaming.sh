# shellcheck shell=bash disable=SC2154,SC2034
# Scenario streaming of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# stream_fetch PATH COOKIE: body to $work/b, headers to $work/h, status in
# $status, time to the first byte in $first and total time in $elapsed.
stream_fetch() {
	local out
	out=$(curl -s -D "$work/h" -o "$work/b" \
		-w '%{http_code} %{time_starttransfer} %{time_total}' -b "$2" "$panel$1")
	read -r status first elapsed <<<"$out"
}

scenario_streaming() {
	echo "# pages send their frame and a skeleton before the API answers"
	fresh
	login admin correct-horse
	local good=$cookie page gap
	# The API takes two seconds per answer. A page that waited for its data
	# before sending anything would have its first byte arrive with the last.
	set_delay 2000
	for page in "" /domains /accounts /queue /suppression /deliveries; do
		stream_fetch "$adm$page" "$good"
		assert_eq "slow API, ${page:-/}: the page answers" "$status" 200
		assert_between "slow API, ${page:-/}: the whole page waits for the data" "$elapsed" 1.9 9
		gap=$(LC_ALL=C awk -v t="$elapsed" -v f="$first" 'BEGIN { printf "%.3f", t - f }')
		assert_between "slow API, ${page:-/}: the first byte leaves at least a second before the data" "$gap" 1 9
		assert_contains "slow API, ${page:-/}: the frame carries a loading placeholder" "$(cat "$work/b")" 'aria-busy="true"'
		assert_contains "slow API, ${page:-/}: the policy still carries a nonce" "$(header content-security-policy)" "'nonce-"
	done
	stream_fetch "$adm/domains" "$good"
	assert_contains "slow API: the data arrives in the same response" "$(cat "$work/b")" "example.test"

	set_delay 0
	stream_fetch "$adm/domains" "$good"
	assert_between "the delay off: the page is quick again" "$elapsed" 0 1.5
	assert_contains "the delay off: the data is there" "$(cat "$work/b")" "example.test"
}
