# shellcheck shell=bash disable=SC2154,SC2034
# Scenario accounts of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# A password that passes the policy, and the one the stand-in's breach list
# holds: neither may appear where it should not.
ACCOUNTS_PASSWORD="a perfectly fine pass"
ACCOUNTS_BREACHED="password-is-breached"

# accounts_action NAME ARGS_JSON [COOKIE]: post the action defined in
# features/accounts/actions/NAME, addressed to the accounts page like the
# browser's client does. Body to $work/b, headers to $work/h, status printed.
accounts_action() {
	local saved=${action_page:-}
	action_page="$adm/accounts"
	post_action "features/accounts/actions/$1/index.ts" "$2" "${3:-}"
	action_page=$saved
}

# new_account NAME [PASSWORD] [EXTRA_JSON_FIELDS]: the arguments of create-account.
new_account() {
	printf '[{"name":"%s","displayName":"","addresses":["%s@example.test"],"password":"%s"%s}]' \
		"$1" "$1" "${2:-$ACCOUNTS_PASSWORD}" "${3:-}"
}

# Number of stand-in requests of method $1 whose path starts with /api/v1/accounts and is not a read.
lifecycle_calls() {
	api_log | node -e '
		const log = JSON.parse(require("fs").readFileSync(0, "utf8"));
		const hits = log.filter((r) => r.method === process.argv[1] && /^\/api\/v1\/accounts(\/[^/]+)?(\?|$)/.test(r.path));
		process.stdout.write(String(hits.length));
	' "$1"
}

scenario_accounts() {
	echo "# accounts: creating and deleting an account, by session, role, input and the server's answer"
	fresh
	login admin correct-horse
	local good=$cookie code
	login user plain-staple
	local plain=$cookie
	reset_api

	# --- no session, and a session that is not an admin's: the 404 of a missing path
	set_404_reference
	assert_eq "no session: create is what a missing path answers" \
		"$(accounts_action create-account "$(new_account carol)")" "$ref_action_status"
	assert_eq "no session: delete is the same" \
		"$(accounts_action delete-account '[{"name":"admin","queue":"discard"}]')" "$ref_action_status"
	assert_eq "a user who is not an admin: create is the same" \
		"$(accounts_action create-account "$(new_account carol)" "$plain")" "$ref_action_status"
	assert_eq "a user who is not an admin: delete is the same" \
		"$(accounts_action delete-account '[{"name":"admin","queue":"discard"}]' "$plain")" "$ref_action_status"
	assert_eq "none of it created an account" "$(lifecycle_calls POST)" 0
	assert_eq "none of it deleted one" "$(lifecycle_calls DELETE)" 0

	# --- the page
	fetch "$adm/accounts" "$good"
	assert_eq "GET $adm/accounts with a session" "$status" 200
	assert_contains "the page offers a new account" "$(cat "$work/b")" "New account"
	assert_contains "each row has its actions, named for the account" "$(cat "$work/b")" "Actions for admin"
	assert_absent "the page carries no inline style" "$(cat "$work/b")" ' style="'

	# --- create: input refused by the panel before the API
	for args in \
		'[{"name":"../status","displayName":"","addresses":["a@example.test"],"password":"a perfectly fine pass"}]' \
		'[{"name":"Carol","displayName":"","addresses":["a@example.test"],"password":"a perfectly fine pass"}]' \
		"$(new_account carol short)" \
		"$(new_account carol 'café café café')" \
		'[{"name":"carol","displayName":"","addresses":[],"password":"a perfectly fine pass"}]' \
		'[{"name":"carol","displayName":"","addresses":["not an address"],"password":"a perfectly fine pass"}]' \
		'[{"name":"carol","displayName":"","addresses":["a@example.test\r\nBcc: x@evil.test"],"password":"a perfectly fine pass"}]' \
		'[{"name":"carol","displayName":"C\r\nX-Injected: 1","addresses":["a@example.test"],"password":"a perfectly fine pass"}]' \
		"$(new_account carol "$ACCOUNTS_PASSWORD" ',"admin":true')"; do
		code=$(accounts_action create-account "$args" "$good")
		assert_contains "create: hostile or malformed input is invalid" "$(cat "$work/b")" '"reason":"invalid"'
	done
	assert_eq "create: none of them reached the API" "$(lifecycle_calls POST)" 0

	# --- create: the server's refusals come back as a category, never its words
	code=$(accounts_action create-account "$(new_account carol "$ACCOUNTS_BREACHED")" "$good")
	assert_contains "create: a breached password is refused by the server as a category" "$(cat "$work/b")" '"kind":"rejected"'
	assert_absent "create: the refusal does not echo the password" "$(cat "$work/b")" "$ACCOUNTS_BREACHED"
	code=$(accounts_action create-account '[{"name":"carol","displayName":"","addresses":["carol@elsewhere.test"],"password":"a perfectly fine pass"}]' "$good")
	assert_contains "create: an address outside the hosted domains is refused as a category" "$(cat "$work/b")" '"kind":"rejected"'
	assert_absent "create: the refusal does not carry the server's message" "$(cat "$work/b")" "hosted domain"
	code=$(accounts_action create-account "$(new_account admin)" "$good")
	assert_contains "create: a name in use is refused as a category" "$(cat "$work/b")" '"kind":"rejected"'

	# --- create: it works, once
	code=$(accounts_action create-account '[{"name":"carol","displayName":"Carol C","addresses":["carol@example.test","c@example.test"],"password":"a perfectly fine pass"}]' "$good")
	assert_eq "create: the action answers" "$code" 200
	assert_contains "create: done, with the stored name" "$(cat "$work/b")" '"kind":"done","value":"carol"'
	assert_absent "create: the answer does not carry the password" "$(cat "$work/b")" "$ACCOUNTS_PASSWORD"
	assert_contains "create: the answer is not cached" "$(header cache-control)" "no-store"
	assert_contains "create: the stand-in holds the account with both addresses" "$(curl -s "$api/__control/accounts")" '"addresses":["carol@example.test","c@example.test"]'
	fetch "$adm/accounts" "$good"
	assert_contains "create: the list shows it" "$(cat "$work/b")" "carol@example.test"
	fetch "$adm/accounts/carol" "$good"
	assert_eq "create: its own page opens" "$status" 200

	# --- create: the cap of the server is a conflict
	code=$(accounts_action create-account "$(new_account busy-one)" "$good")
	code=$(accounts_action create-account "$(new_account busy-two)" "$good")
	assert_contains "create: up to the server's limit" "$(cat "$work/b")" '"kind":"done"'
	code=$(accounts_action create-account "$(new_account dave)" "$good")
	assert_contains "create: past the limit is a conflict" "$(cat "$work/b")" '"kind":"conflict"'

	# --- delete: input refused before the API
	local before
	before=$(lifecycle_calls DELETE)
	for args in \
		'[{"name":"carol"}]' \
		'[{"name":"carol","queue":"all"}]' \
		'[{"name":"carol","queue":"discard&force=1"}]' \
		'[{"name":"../status","queue":"drain"}]' \
		'[{"name":"carol?queue=discard","queue":"drain"}]' \
		'[{"name":"carol","queue":"drain","force":true}]'; do
		code=$(accounts_action delete-account "$args" "$good")
		assert_contains "delete: a missing or hostile choice or name is invalid" "$(cat "$work/b")" '"reason":"invalid"'
	done
	assert_eq "delete: none of them reached the API" "$(lifecycle_calls DELETE)" "$before"

	# --- delete: what the API does not manage, and what it does
	code=$(accounts_action delete-account '[{"name":"ops","queue":"drain"}]' "$good")
	assert_contains "delete: an account of the configuration file is not found for deletion" "$(cat "$work/b")" '"kind":"notFound"'
	assert_contains "delete: and it is still there" "$(curl -s "$api/__control/accounts")" '"ops"'
	code=$(accounts_action delete-account '[{"name":"busy-one","queue":"drain"}]' "$good")
	assert_contains "delete: with drain, the queued mail is left to be delivered" "$(cat "$work/b")" '"left":2,"discarded":0'
	code=$(accounts_action delete-account '[{"name":"busy-two","queue":"discard"}]' "$good")
	assert_contains "delete: with discard, it is dropped" "$(cat "$work/b")" '"left":0,"discarded":2'
	code=$(accounts_action delete-account '[{"name":"carol","queue":"drain"}]' "$good")
	assert_contains "delete: an account with nothing queued" "$(cat "$work/b")" '"left":0,"discarded":0'
	code=$(accounts_action delete-account '[{"name":"carol","queue":"drain"}]' "$good")
	assert_contains "delete: a second time it is gone" "$(cat "$work/b")" '"kind":"notFound"'
	fetch "$adm/accounts" "$good"
	assert_absent "delete: the list no longer shows it" "$(cat "$work/b")" "carol@example.test"
	fetch "$adm/accounts/carol" "$good"
	assert_absent "delete: its page is gone" "$(cat "$work/b")" 'id="mailboxes-title"'

	# --- the secrets
	assert_absent "the panel log never holds a password" "$(cat "$work/panel.log")" "$ACCOUNTS_PASSWORD"
	assert_absent "the panel log never holds a refused one" "$(cat "$work/panel.log")" "$ACCOUNTS_BREACHED"
	assert_absent "the stand-in log never holds one" "$(api_log)" "$ACCOUNTS_PASSWORD"
}
