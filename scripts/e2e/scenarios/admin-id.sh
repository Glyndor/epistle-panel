# shellcheck shell=bash disable=SC2154,SC2034
# Scenario admin-id of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_admin_id() {
	echo "# admin id: one sign-in, the role in the token, the area only for an admin with the id, and no leak of the id"
	fresh
	set_404_reference
	local admin_cookie user_cookie
	login admin correct-horse
	admin_cookie=$cookie
	assert_eq "an admin signs in at the root" "$status" 303
	assert_eq "an admin is sent to the mail area" "$(header location)" "/app/mail"
	login user plain-staple
	user_cookie=$cookie
	assert_eq "an account that is not an admin signs in too" "$status" 303
	assert_eq "and is sent to the same mail area" "$(header location)" "/app/mail"
	assert_contains "and gets the one session cookie" "$user_cookie" "$SESSION_COOKIE_NAME="
	reset_api

	# --- the mail area: any role, and only an admin is offered the way in
	fetch /app/mail "$user_cookie"
	assert_eq "a user session reaches the mail area" "$status" 200
	assert_no_id "$(cat "$work/b")" "the mail page of a user"
	assert_no_id "$(cat "$work/h")" "the headers of the mail page of a user"
	fetch /app/mail "$admin_cookie"
	assert_eq "an admin session reaches the mail area" "$status" 200
	assert_contains "the admin is offered the admin area, with the id built on the server" "$(cat "$work/b")" "href=\"$adm\""

	# --- the admin area: session and role and id, otherwise the 404 of a missing path
	reset_api
	fetch "$adm" "$admin_cookie"
	assert_eq "the admin session with the right id reaches the admin area" "$status" 200
	fetch "$adm/queue" "$admin_cookie"
	assert_eq "the admin queue page" "$status" 200
	assert_contains "its navigation links carry the id" "$(cat "$work/b")" "href=\"$adm/domains\""
	assert_hidden "a user session with the right id" "$adm" "$user_cookie"
	assert_hidden "a user session on a page of the area" "$adm/queue" "$user_cookie"
	assert_hidden "a user session on the account page" "$adm/accounts/admin" "$user_cookie"
	assert_eq "a user session cannot remove a queue entry: it gets what a missing path answers" "$(post_remove "$user_cookie")" "$ref_action_status"
	assert_hidden "an admin session with another UUID" "/app/$(cat /proc/sys/kernel/random/uuid)/queue" "$admin_cookie"
	assert_hidden "an admin session with the id in upper case" "/app/${admin_id^^}/queue" "$admin_cookie"
	assert_hidden "an admin session on /app" "/app" "$admin_cookie"
	assert_hidden "an admin session on the old /app/queue" "/app/queue" "$admin_cookie"
	assert_eq "none of the refused requests reached the API but the admin's own pages" "$(api_count '"method":"DELETE"')" 0
	# A client-chosen host does not turn the hidden request into a trip elsewhere.
	curl -s -o "$work/b" -D "$work/h" -H "X-Forwarded-Host: evil.test" "$panel/app/$(cat /proc/sys/kernel/random/uuid)/queue"
	compare_with_reference "a forged X-Forwarded-Host on a hidden path" "$(head -1 "$work/h" | cut -d' ' -f2)"
	curl -s -o "$work/b" -D "$work/h" -H "Host: evil.test" "$panel$adm/queue"
	compare_with_reference "a forged Host on a hidden path" "$(head -1 "$work/h" | cut -d' ' -f2)"
	assert_absent "the server did not try to reach the forged host" "$(cat "$work/panel.log")" "evil.test"

	# --- a role changed in the token breaks its signature
	local forged payload tail
	payload=${user_cookie#*=}
	payload=${payload%%.*}
	forged=$(printf '%s' "$payload" | tr '_-' '/+' | base64 -d 2>/dev/null | sed 's/"role":"user"/"role":"admin"/' | base64 -w0 | tr '/+' '_-' | tr -d '=')
	tail=${user_cookie#*.}
	assert_contains "the forged payload does say admin" "$(printf '%s' "$forged" | tr '_-' '/+' | base64 -d 2>/dev/null)" '"role":"admin"'
	assert_hidden "a user token whose role was edited to admin" "$adm/queue" "$SESSION_COOKIE_NAME=$forged.$tail"

	# --- the id is in no public response, no public asset and no log
	local path
	for path in / /robots.txt /no-such-page /app/mail; do
		fetch "$path"
		assert_no_id "$(cat "$work/b")" "GET $path (no session)"
		assert_no_id "$(cat "$work/h")" "the headers of GET $path (no session)"
	done
	assert_no_id "$(grep -r -l -F "$admin_id" "$standalone/.next/static" 2>/dev/null || true)" "the public static bundle"
	assert_no_id "$(cat "$work/panel.log")" "the server log"

	# --- the id as a file, like the other secrets, and the same behaviour
	local id_file=$work/secrets/admin-id other_id
	other_id=$(cat /proc/sys/kernel/random/uuid)
	write_secret "$other_id" "$id_file"
	panel_admin_id=""
	panel_env=(EPISTLE_PANEL_ADMIN_ID_FILE="$id_file")
	start_panel
	login admin correct-horse
	admin_cookie=$cookie
	fetch "/app/$other_id/queue" "$admin_cookie"
	assert_eq "the id read from a file opens the admin area" "$status" 200
	assert_hidden "the id of the first start no longer opens it" "$adm/queue" "$admin_cookie"
	panel_env=()

	# --- no id: the admin area is off, an admin included, and the start says so
	panel_admin_id=""
	start_panel
	assert_contains "the start logs that the admin area is off" "$(cat "$work/panel.log")" "EPISTLE_PANEL_ADMIN_ID is not set"
	login admin correct-horse
	admin_cookie=$cookie
	fetch /app/mail "$admin_cookie"
	assert_eq "with no id the mail area still answers" "$status" 200
	assert_eq "with no id the admin is offered no way in (no link to an id under /app, the mail links apart)" "$({ grep -o -E 'href="/app/[0-9a-f]{8}-' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	set_404_reference
	reset_api
	login admin correct-horse
	admin_cookie=$cookie
	for path in "$adm" "$adm/queue" "/app/$other_id/queue" "/app/queue" "/app"; do
		assert_hidden "with no id, an admin session on $path" "$path" "$admin_cookie"
	done
	assert_eq "with no id, nothing reached the API but the sign-in" "$(($(api_count '"method"') - $(api_count '"path":"/api/v1/auth/verify"')))" 0

	# --- a malformed id stops the start and names the variable, never the value
	local bad
	for bad in "not-a-uuid" "${admin_id^^}" "6ba7b810-9dad-11d1-80b4-00c04fd430c8" "018f3a6e-7b2c-7c5a-9a3b-1c2d3e4f5a6b" "${admin_id}0"; do
		stop_pid "$panel_pid"
		panel_pid=""
		(
			cd "$standalone" || exit 1
			exec env -i PATH="$PATH" NODE_ENV=production PORT="$panel_port" \
				HOSTNAME=127.0.0.1 NEXT_TELEMETRY_DISABLED=1 \
				EPISTLE_API_URL="$api" EPISTLE_API_TOKEN_FILE="$api_token_file" \
				EPISTLE_PANEL_SESSION_SECRET_FILE="$session_secret_file" \
				EPISTLE_PANEL_ADMIN_ID="$bad" \
				timeout 20 node server.js
		) >"$work/bad.log" 2>&1 &
		panel_pid=$!
		local code=0
		wait "$panel_pid" || code=$?
		panel_pid=""
		if ((code != 0 && code != 124)); then
			ok "a malformed id ($bad) stops the start (exit $code)"
		else
			not_ok "a malformed id ($bad) stops the start" "exit $code; the server kept running or exited cleanly"
		fi
		assert_contains "the message names the variable" "$(cat "$work/bad.log")" "EPISTLE_PANEL_ADMIN_ID"
		assert_absent "the message does not carry the value" "$(cat "$work/bad.log")" "$bad"
	done
	panel_admin_id=$admin_id
}
