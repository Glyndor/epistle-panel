# shellcheck shell=bash disable=SC2154,SC2034
# Scenario noauth of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_noauth() {
	echo "# no session: every route and Server Action is denied before the API"
	fresh
	login admin correct-horse
	local good=$cookie
	remove_args "$good"
	local logout_field_name
	logout_field_name=$(logout_field "$good")
	local tampered="${good%?}"
	if [[ "${good: -1}" == "A" ]]; then tampered+="B"; else tampered+="A"; fi
	reset_api

	local path
	for path in / /accounts /domains /queue "/queue?cursor=11111111-1111-4111-8111-111111111111" /nope /login/../queue; do
		fetch "$path"
		assert_eq "no cookie: GET $path" "$status" 307
		assert_contains "no cookie: $path goes to /login" "$(header location)" "/login"
	done
	fetch /queue "$SESSION_COOKIE_NAME=garbage"
	assert_eq "garbage cookie" "$status" 307
	fetch /queue "$tampered"
	assert_eq "cookie with a changed signature" "$status" 307
	fetch /queue "$SESSION_COOKIE_NAME="
	assert_eq "empty cookie" "$status" 307

	curl -s -o /dev/null -D "$work/h" "$panel/queue" "${REMOVE_ARGS[@]}"
	assert_eq "no cookie: remove-entry form post" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	curl -s -o /dev/null -D "$work/h" -X POST -H "Next-Action: $REMOVE_ACTION_ID" \
		-H 'Content-Type: text/plain;charset=UTF-8' -d "[null,\"$REMOVE_ID\"]" "$panel/queue"
	assert_eq "no cookie: remove-entry fetch with Next-Action" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	curl -s -o /dev/null -D "$work/h" -b "$tampered" "$panel/queue" "${REMOVE_ARGS[@]}"
	assert_eq "tampered cookie: remove-entry form post" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	curl -s -o /dev/null -D "$work/h" "$panel/" -F "$logout_field_name="
	assert_eq "no cookie: logout action" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	assert_eq "none of it reached the stand-in" "$(api_count '"method"')" 0

	curl -s -o /dev/null -D "$work/h" -b "$good" "$panel/queue" "${REMOVE_ARGS[@]}"
	assert_eq "with the session the same post is accepted" "$(api_count '"method":"DELETE"')" 1
	fetch /queue "$good"
	assert_absent "the removed entry is gone from the page" "$(cat "$work/b")" "$REMOVE_ID"
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
