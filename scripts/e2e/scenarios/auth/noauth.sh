# shellcheck shell=bash disable=SC2154,SC2034
# Scenario noauth of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_noauth() {
	echo "# no session: the admin area is the 404 of a missing path, never a redirect, and nothing reaches the API"
	fresh
	login admin correct-horse
	local good=$cookie
	local logout_field_name
	logout_field_name=$(logout_field "$good")
	local tampered="${good%?}"
	if [[ "${good: -1}" == "A" ]]; then tampered+="B"; else tampered+="A"; fi
	reset_api
	set_404_reference
	assert_eq "the reference path is a 404" "$ref_status" 404

	local path other
	other=$(cat /proc/sys/kernel/random/uuid)
	# Every page of the admin area, known or not, with the right id and without a
	# session: the same 404 as a path that does not exist, not a redirect.
	for path in "$adm" "$adm/accounts" "$adm/domains" "$adm/queue" "$adm/queue?cursor=11111111-1111-4111-8111-111111111111" "$adm/deliveries" "$adm/deliveries?outcome=failed" "$adm/suppression" "$adm/suppression?after=alpha%40example.test" "$adm/nope" "$adm/accounts/admin" "/APP/$admin_id/queue" "/%61pp/$admin_id/queue"; do
		assert_hidden "no cookie: GET $path" "$path"
	done
	# A wrong id, any other UUID, a near miss of the real one, and /app itself.
	for path in "/app/$other/queue" "/app/${admin_id^^}/queue" "/app/${admin_id:0:35}/queue" "/app/${admin_id}0/queue" "/app/${admin_id//-/}/queue" "/app" "/app/queue" "/app/accounts" "/app/nope" "/app/mail/../queue"; do
		assert_hidden "no cookie: GET $path" "$path"
		assert_hidden "with a session: GET $path" "$path" "$good"
	done
	# The pages that used to live elsewhere are gone, with and without a session,
	# and so is the old sign-in page.
	for path in /login /accounts /domains /queue "/queue?cursor=11111111-1111-4111-8111-111111111111" /accounts/admin /app/login "$adm/login"; do
		assert_hidden "no cookie: GET $path" "$path"
	done
	# Public by design: the sign-in page at the root, robots.txt and the assets.
	fetch /
	assert_eq "no cookie: GET / is the sign-in page" "$status" 200
	assert_contains "the sign-in page asks for a name" "$(cat "$work/b")" 'name="name"'
	fetch / "$good"
	assert_eq "with a session: GET / forwards" "$status" 307
	assert_contains "with a session: / goes to the mail area" "$(header location)" "/app/mail"
	fetch /app/mail
	assert_eq "no cookie: GET /app/mail" "$status" 307
	assert_eq "no cookie: /app/mail goes to the sign-in page" "$(header location)" "/"
	fetch /robots.txt
	assert_eq "no cookie: GET /robots.txt" "$status" 200
	assert_contains "robots.txt refuses everything" "$(cat "$work/b")" "Disallow: /"
	assert_absent "robots.txt allows nothing" "$(cat "$work/b")" "Allow:"
	assert_eq "robots.txt carries x-robots-tag" "$(header x-robots-tag)" "noindex, nofollow, noarchive, nosnippet, noimageindex"
	for path in /robots.txtx /robots.txt/queue /x/robots.txt /ROBOTS.TXT /sitemap.xml "/app/robots.txt"; do
		assert_hidden "no cookie: GET $path is not robots.txt" "$path"
	done
	for path in "$adm/queue" "$adm"; do
		assert_hidden "garbage cookie: GET $path" "$path" "$SESSION_COOKIE_NAME=garbage"
		assert_hidden "cookie with a changed signature: GET $path" "$path" "$tampered"
		assert_hidden "empty cookie: GET $path" "$path" "$SESSION_COOKIE_NAME="
	done

	assert_action_hidden "no cookie: remove-entry action" features/queue/actions/remove-entry/index.ts "[{\"id\":\"$REMOVE_ID\"}]" "$adm/queue"
	assert_action_hidden "tampered cookie: remove-entry action" features/queue/actions/remove-entry/index.ts "[{\"id\":\"$REMOVE_ID\"}]" "$adm/queue" "$tampered"
	assert_action_hidden "garbage cookie: remove-entry action" features/queue/actions/remove-entry/index.ts "[{\"id\":\"$REMOVE_ID\"}]" "$adm/queue" "$SESSION_COOKIE_NAME=garbage"
	curl -s -o "$work/b" -D "$work/h" "$panel$adm" -F "$logout_field_name="
	compare_action_with_reference "no cookie: logout action posted to the admin area" "$(head -1 "$work/h" | cut -d' ' -f2)"
	assert_eq "none of it reached the stand-in" "$(api_count '"method"')" 0

	assert_eq "with the session the same action is accepted" "$(post_remove "$good")" 200
	assert_eq "with the session the same post reaches the API once" "$(api_count '"method":"DELETE"')" 1
	fetch "$adm/queue" "$good"
	assert_absent "the removed entry is gone from the page" "$(cat "$work/b")" "$REMOVE_ID"
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
