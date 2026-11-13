# shellcheck shell=bash disable=SC2154,SC2034
# Scenario noauth of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_noauth() {
	echo "# no session: every route and Server Action is denied before the API"
	fresh
	login admin correct-horse
	local good=$cookie
	local logout_field_name
	logout_field_name=$(logout_field "$good")
	local tampered="${good%?}"
	if [[ "${good: -1}" == "A" ]]; then tampered+="B"; else tampered+="A"; fi
	reset_api

	local path
	# The signed-in area is /app and everything under it, known page or not.
	for path in /app /app/accounts /app/domains /app/queue "/app/queue?cursor=11111111-1111-4111-8111-111111111111" /app/deliveries "/app/deliveries?outcome=failed" /app/suppression "/app/suppression?after=alpha%40example.test" /app/nope /app/accounts/admin /login/../app/queue /APP/queue /%61pp/queue; do
		fetch "$path"
		assert_eq "no cookie: GET $path" "$status" 307
		assert_contains "no cookie: $path goes to /login" "$(header location)" "/login"
	done
	# Next folds a doubled slash into the canonical path before any page runs,
	# and the canonical path is then gated; no page is served on the way.
	fetch //app/queue
	assert_eq "no cookie: GET //app/queue is sent to the canonical path" "$status" 308
	assert_contains "no cookie: //app/queue goes to /app/queue" "$(header location)" "/app/queue"
	# The root only forwards to /app, which is where the session is asked for.
	fetch /
	assert_eq "no cookie: GET /" "$status" 307
	assert_contains "no cookie: / goes to /app, not to a page" "$(header location)" "/app"
	assert_absent "no cookie: / does not go to /login itself" "$(header location)" "/login"
	fetch / "$good"
	assert_eq "with a session: GET /" "$status" 307
	assert_contains "with a session: / goes to /app" "$(header location)" "/app"
	# The pages that used to live outside /app are gone, with and without a session.
	for path in /accounts /domains /queue "/queue?cursor=11111111-1111-4111-8111-111111111111" /accounts/admin; do
		fetch "$path"
		assert_eq "no cookie: GET $path is a 404, not a gate" "$status" 404
		fetch "$path" "$good"
		assert_eq "with a session: GET $path is a 404" "$status" 404
	done
	# Public by design: the sign-in page and the operator's assets.
	for path in /login /robots.txt; do
		fetch "$path"
		assert_eq "no cookie: GET $path is public" "$status" 200
	done
	fetch /robots.txt
	assert_eq "no cookie: GET /robots.txt" "$status" 200
	assert_contains "robots.txt refuses everything" "$(cat "$work/b")" "Disallow: /"
	assert_absent "robots.txt allows nothing" "$(cat "$work/b")" "Allow:"
	assert_eq "robots.txt carries x-robots-tag" "$(header x-robots-tag)" "noindex, nofollow, noarchive, nosnippet, noimageindex"
	for path in /robots.txtx /robots.txt/queue /x/robots.txt /ROBOTS.TXT /sitemap.xml; do
		fetch "$path"
		assert_eq "no cookie: GET $path is not robots.txt, and answers a 404" "$status" 404
	done
	fetch /app/robots.txt
	assert_eq "no cookie: GET /app/robots.txt stays behind the gate" "$status" 307
	fetch /app/queue "$SESSION_COOKIE_NAME=garbage"
	assert_eq "garbage cookie" "$status" 307
	fetch /app/queue "$tampered"
	assert_eq "cookie with a changed signature" "$status" 307
	fetch /app/queue "$SESSION_COOKIE_NAME="
	assert_eq "empty cookie" "$status" 307

	assert_eq "no cookie: remove-entry action" "$(post_remove)" 307
	assert_eq "tampered cookie: remove-entry action" "$(post_remove "$tampered")" 307
	assert_eq "garbage cookie: remove-entry action" "$(post_remove "$SESSION_COOKIE_NAME=garbage")" 307
	curl -s -o /dev/null -D "$work/h" "$panel/app" -F "$logout_field_name="
	assert_eq "no cookie: logout action" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	assert_eq "none of it reached the stand-in" "$(api_count '"method"')" 0

	assert_eq "with the session the same action is accepted" "$(post_remove "$good")" 200
	assert_eq "with the session the same post reaches the API once" "$(api_count '"method":"DELETE"')" 1
	fetch /app/queue "$good"
	assert_absent "the removed entry is gone from the page" "$(cat "$work/b")" "$REMOVE_ID"
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
