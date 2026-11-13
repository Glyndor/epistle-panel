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
	fetch /app/queue "$old"
	assert_eq "GET /app/queue before logout" "$status" 200
	local field
	field=$(logout_field "$old")
	[[ -n "$field" ]] || not_ok "found the logout form field"

	local before after
	before=$(api_count '"path":"/api/v1/queue')
	curl -s -o /dev/null -D "$work/h" -b "$old" "$panel/app" -F "$field="
	assert_contains "logout redirects to /login" "$(header location)" "/login"
	assert_contains "logout expires the cookie" "$(grep -i '^set-cookie' "$work/h" | tr -d '\r')" "Max-Age=0"

	fetch /app/queue "$old"
	assert_eq "replayed cookie on /app/queue" "$status" 307
	assert_contains "replayed cookie goes to /login" "$(header location)" "/login"
	assert_eq "replayed cookie on a Server Action" "$(post_remove "$old")" 307
	after=$(api_count '"path":"/api/v1/queue')
	assert_eq "the revoked token reached no queue endpoint" "$after" "$before"

	fetch /app/queue "$other"
	assert_eq "another session survives the logout" "$status" 200
}
