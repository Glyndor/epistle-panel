# shellcheck shell=bash disable=SC2154,SC2034
# Scenario account-detail of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# The public secret the stand-in hands out on a TOTP enrolment, and a password
# that passes the policy: neither may appear where it should not.
ACCOUNT_TOTP_SECRET="STANDINTOTPSECRET2"
ACCOUNT_PASSWORD="a perfectly fine pass"

# account_action NAME ARGS_JSON [COOKIE]: post the account action defined in
# features/account-detail/actions/NAME, addressed to the account page like the
# browser's client does. Body to $work/b, headers to $work/h, status printed.
account_action() {
	local saved=${action_page:-}
	action_page="$adm/accounts/admin"
	post_action "features/account-detail/actions/$1/index.ts" "$2" "${3:-}"
	action_page=$saved
}

# account_state: the stand-in's view of every account, as JSON.
account_state() {
	curl -s "$api/__control/accounts"
}

# Number of stand-in requests of method $1 whose path contains $2.
api_calls() {
	api_log | node -e '
		const log = JSON.parse(require("fs").readFileSync(0, "utf8"));
		const hits = log.filter((r) => r.method === process.argv[1] && r.path.includes(process.argv[2]));
		process.stdout.write(String(hits.length));
	' "$1" "$2"
}

scenario_account_detail() {
	echo "# account detail page: session, name validation, the account actions and the secrets"
	fresh
	login admin correct-horse
	local good=$cookie code path body
	reset_api

	# --- no session: redirected, and nothing reaches the API
	set_404_reference
	for path in "$adm/accounts/admin" "$adm/accounts/nobody" "$adm/accounts/..%2fstatus" "$adm/accounts/Admin;" ; do
		assert_hidden "no cookie: GET $path" "$path"
	done
	assert_hidden "garbage cookie: GET the account page" "$adm/accounts/admin" "$SESSION_COOKIE_NAME=garbage"
	assert_eq "no session: the account actions are what a missing path answers" \
		"$(account_action set-display-name '[{"name":"admin","displayName":"x"}]')" "$ref_action_status"
	assert_eq "no session: enrolling two-factor is the same" \
		"$(account_action enroll-totp '[{"name":"admin"}]')" "$ref_action_status"
	assert_eq "no session: none of it reached the stand-in" "$(api_count '"method"')" 0

	# --- with a session: the page, server-rendered from the API
	fetch "$adm/accounts/admin" "$good"
	assert_eq "GET $adm/accounts/admin with a session" "$status" 200
	body=$(cat "$work/b")
	assert_contains "the page names the account" "$body" "Account admin"
	assert_contains "the page lists its address" "$body" "admin@example.test"
	assert_contains "the page shows the display name in its field" "$body" "Admin Person"
	assert_contains "the page lists a mailbox of the tree" "$body" "Work"
	assert_contains "the page carries the section the hostile names must lack" "$body" 'id="mailboxes-title"'
	assert_contains "the page lists an archived message to restore" "$body" "Restore"
	assert_eq "the page has no inline style attribute or element" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	assert_contains "the page is never cached" "$(header cache-control)" "no-store"
	assert_eq "every API call for the page carried the valid bearer" \
		"$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
	assert_eq "the page asked for the account list once" "$(api_count '"path":"/api/v1/accounts"')" 1
	assert_eq "the page asked for the mailboxes of admin" "$(api_calls GET '/api/v1/accounts/admin/mailboxes')" 1
	assert_eq "the page asked for the masked addresses of admin" "$(api_calls GET '/api/v1/accounts/admin/masked')" 1
	assert_eq "the page asked for the archive of admin" "$(api_calls GET '/api/v1/accounts/admin/archive')" 1
	assert_eq "the page asked about no other account" "$(api_calls GET '/api/v1/accounts/ops')" 0
	assert_contains "the account list links to this page" \
		"$(curl -s -b "$good" "$panel$adm/accounts")" "href=\"$adm/accounts/admin\""

	# --- an archive the server does not keep is a plain state, not a failure
	fetch "$adm/accounts/ops" "$good"
	assert_eq "GET $adm/accounts/ops (archive off)" "$status" 200
	assert_contains "the archive is reported as not available" "$(cat "$work/b")" "The archive is not available"
	assert_absent "the 404 of the archive is not logged as a failure" "$(cat "$work/panel.log")" "account archive failed"

	# --- hostile and unknown names: the panel's not-found page, and no per-account
	# call. The status stays 200 for these: the shell is streamed before the page
	# resolves, so a `notFound()` thrown by the page cannot change it (measured on
	# Next 16.4.6); the body is what tells them apart from the account page.
	reset_api
	for path in "$adm/accounts/nobody" "$adm/accounts/Admin" "$adm/accounts/ADMIN" "$adm/accounts/admin%2fpassword" \
		"$adm/accounts/..%2f..%2fstatus" "$adm/accounts/%2e%2e%2fstatus" \
		"$adm/accounts/a%0d%0ax" "$adm/accounts/a%0ax" "$adm/accounts/%C3%A9" "$adm/accounts/%EF%BC%A1" "$adm/accounts/%00" \
		"$adm/accounts/a%20b" "$adm/accounts/a%3Fqueue=drain" "$adm/accounts/-admin"; do
		fetch "$path" "$good"
		assert_contains "hostile name: GET $path shows the not-found page" "$(cat "$work/b")" "Page not found"
		assert_absent "hostile name: GET $path is not an account page" "$(cat "$work/b")" 'id="mailboxes-title"'
	done
	assert_eq "unknown and hostile names reached no per-account endpoint" "$(api_calls GET '/api/v1/accounts/')" 0
	assert_eq "no hostile name reached any write" "$(api_count '"method":"PUT"')" 0
	fetch "$adm/accounts/%2e" "$good"
	assert_eq "a dot segment is normalised away by Next before the page" "$status" 308
	fetch "$adm/accounts/%2e%2e" "$good"
	assert_absent "an encoded .. is resolved by Next to another page, never to an account" "$(cat "$work/b")" 'id="mailboxes-title"'
	curl -s -o /dev/null --path-as-is -b "$good" "$panel$adm/accounts/../../api/v1/status"
	assert_eq "no path through the panel reached a per-account endpoint" "$(api_calls GET '/api/v1/accounts/')" 0

	# --- the actions: a hostile name or value is refused before the API
	reset_api
	code=$(account_action set-display-name '[{"name":"../status","displayName":"x"}]' "$good")
	assert_eq "display name for a hostile name: the action answers" "$code" 200
	assert_contains "display name for a hostile name is invalid" "$(cat "$work/b")" '"reason":"invalid"'
	code=$(account_action set-display-name '[{"name":"admin","displayName":"a\u0007b"}]' "$good")
	assert_contains "a control character in a display name is invalid" "$(cat "$work/b")" '"reason":"invalid"'
	code=$(account_action remove-masked '[{"name":"admin","address":"../status"}]' "$good")
	assert_contains "a masked address that is a path is invalid" "$(cat "$work/b")" '"reason":"invalid"'
	code=$(account_action restore-archive '[{"name":"admin","id":"../x"}]' "$good")
	assert_contains "an archive id that is not a UUID is invalid" "$(cat "$work/b")" '"reason":"invalid"'
	code=$(account_action set-password '[{"name":"ops","password":"short"}]' "$good")
	assert_contains "a short password is invalid" "$(cat "$work/b")" '"reason":"invalid"'
	code=$(account_action set-password '[{"name":"ops","password":"café café café"}]' "$good")
	assert_contains "a non-ASCII password is invalid" "$(cat "$work/b")" '"reason":"invalid"'
	assert_eq "none of the refused inputs reached the stand-in" "$(api_count '"method"')" 0

	# --- the actions that work
	code=$(account_action set-display-name '[{"name":"admin","displayName":"  Renamed Person  "}]' "$good")
	assert_contains "display name: done" "$(cat "$work/b")" '"kind":"done"'
	assert_contains "display name: the stored name comes back trimmed" "$(cat "$work/b")" 'Renamed Person'
	assert_contains "display name: the stand-in stored it" "$(account_state)" '"displayName":"Renamed Person"'

	code=$(account_action set-password "[{\"name\":\"ops\",\"password\":\"$ACCOUNT_PASSWORD\"}]" "$good")
	assert_contains "password: done" "$(cat "$work/b")" '"kind":"done"'
	assert_absent "password: the answer does not carry it" "$(cat "$work/b")" "$ACCOUNT_PASSWORD"
	assert_contains "password: the stand-in counted one change" "$(account_state)" '"passwordChanges":1'
	code=$(account_action set-password '[{"name":"ops","password":"password1234"}]' "$good")
	assert_contains "password: a breached one is refused by the server as a category" "$(cat "$work/b")" '"kind":"rejected"'
	assert_absent "password: the refusal does not echo it" "$(cat "$work/b")" "password1234"
	assert_absent "password: the panel log never holds it" "$(cat "$work/panel.log")" "$ACCOUNT_PASSWORD"
	assert_absent "password: the panel log never holds a refused one" "$(cat "$work/panel.log")" "password1234"
	assert_absent "password: the stand-in log never holds it" "$(api_log)" "$ACCOUNT_PASSWORD"

	code=$(account_action enroll-totp '[{"name":"ops"}]' "$good")
	assert_eq "two-factor enrolment: the action answers" "$code" 200
	assert_contains "two-factor enrolment: the secret is in the answer, the one place it is" "$(cat "$work/b")" "$ACCOUNT_TOTP_SECRET"
	assert_contains "two-factor enrolment: the answer is never cached" "$(header cache-control)" "no-store"
	assert_absent "two-factor enrolment: the panel log never holds the secret" "$(cat "$work/panel.log")" "$ACCOUNT_TOTP_SECRET"
	assert_absent "two-factor enrolment: the stand-in log never holds the secret" "$(api_log)" "$ACCOUNT_TOTP_SECRET"
	fetch "$adm/accounts/ops" "$good"
	assert_absent "two-factor enrolment: the page does not carry the secret afterwards" "$(cat "$work/b")" "$ACCOUNT_TOTP_SECRET"
	code=$(account_action disable-totp '[{"name":"ops"}]' "$good")
	assert_contains "two-factor: turned off" "$(cat "$work/b")" '"kind":"done"'
	assert_contains "two-factor: the stand-in has it off" "$(account_state)" '"totp":false'

	code=$(account_action create-masked '[{"name":"ops","label":"My Shop"}]' "$good")
	assert_contains "masked: created" "$(cat "$work/b")" '"kind":"done"'
	local address
	address=$(grep -o 'my-shop\.[a-z2-7]*@example\.test' "$work/b" | head -1)
	[[ -n "$address" ]] || not_ok "found the minted address in the answer"
	fetch "$adm/accounts/ops" "$good"
	assert_contains "masked: the page lists the new address" "$(cat "$work/b")" "$address"
	code=$(account_action remove-masked "[{\"name\":\"ops\",\"address\":\"$address\"}]" "$good")
	assert_contains "masked: removed" "$(cat "$work/b")" '"kind":"done"'
	assert_eq "masked: the removal reached the API once, with the address encoded" \
		"$(api_calls DELETE "/masked/my-shop.")" 1
	assert_contains "masked: the stand-in holds none" "$(account_state)" '"masked":[]'
	for label in one two three four; do
		code=$(account_action create-masked "[{\"name\":\"ops\",\"label\":\"$label\"}]" "$good")
	done
	assert_contains "masked: the fourth is a conflict, not a failure" "$(cat "$work/b")" '"kind":"conflict"'

	code=$(account_action restore-archive '[{"name":"admin","id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}]' "$good")
	assert_contains "archive: restored" "$(cat "$work/b")" '"kind":"done"'
	assert_contains "archive: it went back to its mailbox" "$(cat "$work/b")" '"restoredTo":"INBOX"'
	code=$(account_action restore-archive '[{"name":"admin","id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}]' "$good")
	assert_contains "archive: a second restore is notFound, not a failure" "$(cat "$work/b")" '"kind":"notFound"'
	assert_eq "every call of the scenario carried the valid bearer" \
		"$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
