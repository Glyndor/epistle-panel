# shellcheck shell=bash disable=SC2154,SC2034
# Scenario rotation of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_rotation() {
	echo "# _FILE secret rotation"
	fresh
	login admin correct-horse
	local old=$cookie
	# No request carries the cookie before the rotation: the proxy reads the
	# secret file on its first one, and that read must find the same value the
	# sign-in action signed with.
	local new_secret="rotated-session-secret-$RANDOM$RANDOM$RANDOM"
	write_secret "$new_secret" "$session_secret_file"
	write_secret "rotated-token-$RANDOM$RANDOM" "$api_token_file"
	fetch /app/queue "$old"
	assert_eq "no restart: the old session still verifies (read once per process)" "$status" 200
	assert_absent "no restart: the old token is still the one sent" "$(cat "$work/b")" 'role="alert"'
	login ops other-battery
	assert_eq "no restart: a new sign-in works (every bundle holds the same secret)" "$status" 303
	fetch /app/queue "$cookie"
	assert_eq "no restart: the new session verifies" "$status" 200

	# The restart picks up both files; the stand-in learns the new token too.
	start_stand_in
	start_panel
	fetch /app/queue "$old"
	assert_eq "after restart: the session signed with the old secret is refused" "$status" 307
	login ops other-battery
	assert_eq "after restart: signing in works with the new files" "$status" 303
	fetch /app/queue "$cookie"
	assert_eq "after restart: the new session verifies" "$status" 200
	assert_absent "after restart: the new token is accepted by the API" "$(cat "$work/b")" 'role="alert"'
	assert_eq "no secret ever reached the server log" \
		"$({ grep -c -F -e "$new_secret" -e correct-horse -e other-battery "$work/panel.log" || true; })" 0
}
