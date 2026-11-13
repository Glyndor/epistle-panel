# shellcheck shell=bash disable=SC2154,SC2034
# Scenario deliveries of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_deliveries() {
	echo "# deliveries: read-only log, filters, and hostile parameters"
	fresh
	login admin correct-horse
	local good=$cookie
	reset_api

	fetch /app/deliveries
	assert_eq "no cookie: GET /app/deliveries" "$status" 307
	assert_contains "no cookie: /app/deliveries goes to /login" "$(header location)" "/login"
	fetch "/app/deliveries?outcome=failed&since=24h"
	assert_eq "no cookie: GET /app/deliveries with filters" "$status" 307
	assert_eq "the denied calls reached no endpoint" "$(api_count '"method"')" 0

	fetch /app/deliveries "$good"
	assert_eq "GET /app/deliveries with a session" "$status" 200
	assert_contains "the log lists a recipient" "$(cat "$work/b")" "ok@example.net"
	assert_contains "the log lists a failed one" "$(cat "$work/b")" "missing@example.net"
	assert_contains "times are in UTC" "$(cat "$work/b")" "Time (UTC)"
	assert_absent "a reply with markup is not printed as markup" "$(cat "$work/b")" "<script>alert(1)</script>"
	assert_contains "it is printed as text" "$(cat "$work/b")" "&lt;script&gt;alert(1)&lt;/script&gt;"
	assert_eq "the page asked the API once, for the 100 it can hold" "$(api_count '"path":"/api/v1/deliveries?limit=100"')" 1

	fetch "/app/deliveries?outcome=failed&since=24h" "$good"
	assert_eq "GET with filters" "$status" 200
	assert_contains "the filtered page keeps the failed record" "$(cat "$work/b")" "missing@example.net"
	assert_absent "and leaves the others out" "$(cat "$work/b")" "ok@example.net"
	assert_eq "the filters reached the API" "$(api_count '"path":"/api/v1/deliveries?outcome=failed&since=24h&limit=100"')" 1

	fetch "/app/deliveries?recipient=ok%40example.net" "$good"
	assert_eq "the recipient reached the API encoded" "$(api_count '"path":"/api/v1/deliveries?recipient=ok%40example.net&limit=100"')" 1

	local before hostile
	before=$(api_count '"path":"/api/v1/deliveries?limit=100"')
	for hostile in "outcome=wonky" "since=..%2Fx" "since=1e9d" "since=24h%0A" "outcome=failed%26account%3Dx" "recipient=a%40b.org%0D%0ABcc%3A%20c%40d.org" "recipient=$(printf 'a%.0s' {1..300})%40x.org" "recipient=%E2%80%AE%40x.org" "limit=1" "account=admin"; do
		fetch "/app/deliveries?$hostile" "$good"
		assert_eq "hostile parameter '${hostile:0:24}' still renders" "$status" 200
	done
	assert_eq "each one fetched the unfiltered log instead" "$(($(api_count '"path":"/api/v1/deliveries?limit=100"') - before))" 10
	assert_eq "no hostile value reached the API" "$(api_count 'wonky')" 0

	assert_eq "the log is read only: no DELETE reached the API" "$(api_count '"method":"DELETE"')" 0
	assert_eq "no write of any kind: only GET and the sign-in POST" "$(($(api_count '"method"') - $(api_count '"method":"GET"')))" "$(api_count '"path":"/api/v1/auth/verify"')"
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
