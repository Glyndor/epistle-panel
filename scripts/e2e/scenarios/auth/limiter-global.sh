# shellcheck shell=bash disable=SC2154,SC2034
# Scenario limiter-global of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_limiter_global() {
	echo "# global ceiling of 60 failed attempts per minute, names that signed in exempt"
	# The floor is off here so 60 sequential failures fit in the window.
	login_min_ms=0
	fresh
	login admin correct-horse
	assert_eq "the admin signs in once, so the name is known" "$status" 303
	local i
	for i in $(seq 1 60); do
		post_login "burst-$i" wrong-password /dev/null /dev/null >/dev/null
	done
	assert_eq "the admin and 60 failing names reached the API" "$(verify_calls)" 61
	login burst-new wrong-password
	assert_eq "an unknown name is refused once 60 failures are in the window" "$(verify_calls)" 61
	assert_eq "and gets no cookie" "$cookie" ""
	login admin correct-horse
	assert_eq "a name that signed in before is still admitted" "$status" 303
	[[ -n "$cookie" ]] && ok "and gets a session cookie" || not_ok "and gets a session cookie"
	assert_eq "the admin's attempt reached the API" "$(verify_calls)" 62
	unset login_min_ms
}
