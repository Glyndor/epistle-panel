# shellcheck shell=bash disable=SC2154,SC2034
# Scenario logout of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_logout() {
	echo "# logout revokes the token across proxy, pages and actions"
	fresh
	login admin correct-horse
	local old=$cookie
	login ops other-battery
	local other=$cookie
	fetch "$adm/queue" "$old"
	assert_eq "GET $adm/queue before logout" "$status" 200
	local field
	field=$(logout_field "$old")
	[[ -n "$field" ]] || not_ok "found the logout form field"

	local before after
	before=$(api_count '"path":"/api/v1/queue')
	curl -s -o /dev/null -D "$work/h" -b "$old" "$panel$adm" -F "$field="
	assert_eq "logout redirects to the sign-in page" "$(header location)" "/"
	assert_contains "logout expires the cookie" "$(grep -i '^set-cookie' "$work/h" | tr -d '\r')" "Max-Age=0"

	set_404_reference
	assert_hidden "replayed cookie on the admin area" "$adm/queue" "$old"
	assert_eq "replayed cookie on a Server Action" "$(post_remove "$old")" "$ref_action_status"
	fetch /app/mail "$old"
	assert_eq "replayed cookie on the mail area" "$status" 307
	after=$(api_count '"path":"/api/v1/queue')
	assert_eq "the revoked token reached no queue endpoint" "$after" "$before"

	fetch "$adm/queue" "$other"
	assert_eq "another session survives the logout" "$status" 200
}
