# shellcheck shell=bash disable=SC2154,SC2034
# Scenario suppression of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# The address the removal checks target: it holds a slash, so it only reaches
# the stand-in if the panel percent-encodes it in the path.
SUPPRESSED_ODD="odd/one@example.test"
SUPPRESSED_ODD_PATH="/api/v1/suppression/odd%2Fone%40example.test"

# post_remove_address JSON [COOKIE]: post the remove-address action with JSON
# as its argument list and print the HTTP status.
post_remove_address() {
	post_action features/suppression/actions/remove-address/index.ts "$1" "${2:-}"
}

scenario_suppression() {
	echo "# suppression: list, page, remove, and hostile addresses"
	fresh
	login admin correct-horse
	local good=$cookie
	reset_api

	fetch /suppression
	assert_eq "no cookie: GET /suppression" "$status" 307
	assert_contains "no cookie: /suppression goes to /login" "$(header location)" "/login"
	assert_eq "no cookie: remove-address action" "$(post_remove_address "[{\"address\":\"alpha@example.test\"}]")" 307
	assert_eq "the denied calls reached no endpoint" "$(api_count '"method"')" 0

	fetch /suppression "$good"
	assert_eq "GET /suppression with a session" "$status" 200
	assert_contains "the first page lists its addresses" "$(cat "$work/b")" "alpha@example.test"
	assert_absent "the first page holds only the first two" "$(cat "$work/b")" "odd/one@example.test"
	assert_contains "the next link carries the cursor, encoded" "$(cat "$work/b")" "/suppression?after=bounce%2Btag%40example.test"
	assert_eq "the page asked the API once, without a cursor" "$(api_count '"path":"/api/v1/suppression"')" 1

	fetch "/suppression?after=bounce%2Btag%40example.test" "$good"
	assert_eq "GET the second page" "$status" 200
	assert_contains "the second page lists the slash address" "$(cat "$work/b")" "$SUPPRESSED_ODD"
	assert_eq "the cursor went to the API encoded" "$(api_count '"path":"/api/v1/suppression?after=bounce%2Btag%40example.test"')" 1

	local before hostile
	before=$(api_count '"method"')
	for hostile in "../status" "a%0Ab%40x.org" "a%40b.org%0D%0ABcc%3A%20c%40d.org" "%2e%2e%2fqueue" "$(printf 'a%.0s' {1..300})%40x.org" "a%40b.org%26account%3Dz%40y.org" "%E2%80%AE%40x.org"; do
		fetch "/suppression?after=$hostile" "$good"
		assert_eq "hostile cursor '${hostile:0:24}' still renders" "$status" 200
	done
	assert_eq "no hostile cursor was forwarded to the API" "$(api_count '"path":"/api/v1/suppression?')" 1
	assert_eq "each hostile page fetched the first page instead" "$(($(api_count '"method"') - before))" 7

	before=$(api_count '"method":"DELETE"')
	local json
	for json in \
		'[{"address":"../status"}]' \
		'[{"address":"a@b.org\nDELETE"}]' \
		'[{"address":"a@b.org\r\nBcc: c@d.org"}]' \
		'[{"address":"%2e%2e%2fstatus"}]' \
		'[{"address":"odd/one@example.test","account":"x@y.test"}]' \
		'[{"address":""}]' \
		'[{}]' \
		'["odd/one@example.test"]' \
		'[]'; do
		post_remove_address "$json" "$good" >/dev/null
		assert_eq "hostile action argument $json reached no DELETE" "$(api_count '"method":"DELETE"')" "$before"
	done
	post_remove_address "[{\"address\":\"$(printf 'a%.0s' {1..300})@x.org\"}]" "$good" >/dev/null
	assert_eq "an address of 300 characters reached no DELETE" "$(api_count '"method":"DELETE"')" "$before"

	assert_eq "a valid removal is accepted" "$(post_remove_address "[{\"address\":\"$SUPPRESSED_ODD\"}]" "$good")" 200
	assert_eq "it reached the API once" "$(api_count '"method":"DELETE"')" "$((before + 1))"
	assert_eq "with the address as one encoded path segment" "$(api_count "\"path\":\"$SUPPRESSED_ODD_PATH\"")" 1
	fetch "/suppression?after=bounce%2Btag%40example.test" "$good"
	assert_absent "the removed address is gone from the page" "$(cat "$work/b")" "$SUPPRESSED_ODD"
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
