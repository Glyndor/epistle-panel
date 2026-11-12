# shellcheck shell=bash disable=SC2154,SC2034
# Scenario body-limit of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_body_limit() {
	echo "# Server Action bodies: refused above the limit before the action runs"
	fresh
	login admin correct-horse
	local good=$cookie
	reset_api

	# The widest sign-in the form can send: a 254 character name and a 1024
	# character password, the password in three-byte characters. That body is
	# about 4.1 KB as multipart, and a CAPTCHA provider token adds 2 to 4 KB, so
	# the 16 KB limit in next.config.ts keeps headroom over the largest request.
	local name password
	name=$(head -c 254 /dev/zero | tr '\0' 'n')
	password=$(printf '€%.0s' $(seq 1 1024))
	login "$name" "$password"
	assert_eq "the widest sign-in is read by the action" "$status" 200
	assert_eq "the widest sign-in reached the API once" "$(verify_calls)" 1

	# The same sign-in with a synthetic 4 KB provider token on top.
	reset_api
	login "$name" "$password" "captcha-token=$(head -c 4096 /dev/zero | tr '\0' 't')"
	assert_eq "the widest sign-in with a 4 KB token is read by the action" "$status" 200
	assert_eq "the widest sign-in with a token reached the API once" "$(verify_calls)" 1

	reset_api
	assert_eq "an in-limit action is accepted" "$(post_remove "$good")" 200
	assert_eq "an in-limit action reaches the API once" "$(api_count '"method":"DELETE"')" 1

	reset_api
	local pad
	pad=$(head -c 40000 /dev/zero | tr '\0' 'a')
	local code
	code=$(post_action features/queue/actions/remove-entry/index.ts \
		"[{\"id\":\"$REMOVE_ID\",\"pad\":\"$pad\"}]" "$good")
	# Next answers a body over the limit with a 500 before it runs the action.
	assert_eq "an oversized action body is refused" "$code" 500
	assert_eq "the refused body never reached the API" "$(api_count '"method"')" 0
	assert_absent "the refusal does not echo the body" "$(cat "$work/b")" "$pad"

	local big
	big=$(head -c 40000 /dev/zero | tr '\0' 'p')
	login admin "$big"
	assert_eq "an oversized sign-in is refused too" "$status" 500
	assert_eq "the refused sign-in never reached the API" "$(verify_calls)" 0
}
