# shellcheck shell=bash disable=SC2154,SC2034
# Scenario limiter of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_limiter() {
	echo "# sign-in limiter and failure floor"
	fresh
	login admin wrong-password
	assert_eq "wrong password is refused without a cookie" "$cookie" ""
	assert_between "a failed login takes about one second" "$elapsed" 1.0 1.8
	assert_eq "the first attempt reached the API" "$(verify_calls)" 1
	local i
	for i in 2 3 4; do
		login admin wrong-password
	done
	assert_eq "three free tries plus the one that sets the lock reached the API" "$(verify_calls)" 4
	login admin correct-horse
	assert_between "a refused attempt takes the same floor" "$elapsed" 1.0 1.8
	assert_eq "the lock holds even for the right password" "$cookie" ""
	assert_eq "locked attempts did not reach the API" "$(verify_calls)" 4
	login ops other-battery
	assert_eq "another name still signs in" "$status" 303
	[[ -n "$cookie" ]] && ok "another name got a session cookie" || not_ok "another name got a session cookie"
	assert_eq "the other name reached the API once" "$(verify_calls)" 5
	sleep 2.2
	login admin correct-horse
	assert_eq "the lock expires: the right password signs in" "$status" 303
	assert_between "a successful login takes the same floor" "$elapsed" 1.0 1.8
	assert_eq "the log never holds a password" "$(api_count 'wrong-password')" 0
}
