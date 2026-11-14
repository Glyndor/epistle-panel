# shellcheck shell=bash disable=SC2154,SC2034
# Scenario csrf of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# post_remove_with COOKIE HEADER...: the remove-entry action with a valid session
# and the given request headers; the status is printed and the DELETEs the
# stand-in saw are counted by the caller.
post_remove_with() {
	local cookie_value=$1
	shift
	action_headers=("$@")
	reset_api
	post_remove "$cookie_value"
	action_headers=()
}

scenario_csrf() {
	echo "# Server Action origin check: what Next enforces, and what the panel leaves to its proxy"
	fresh
	login admin correct-horse
	local good=$cookie code

	# A browser always sends Origin on a cross-site POST. Next compares it with
	# the host the request arrived for, and refuses the action when they differ.
	code=$(post_remove_with "$good" "Origin: https://evil.test")
	assert_eq "a foreign Origin with a valid session is refused" "$code" 500
	assert_eq "a foreign Origin: the action never reached the API" "$(api_count '"method":"DELETE"')" 0
	assert_contains "a foreign Origin: the log says why" "$(cat "$work/panel.log")" "Invalid Server Actions request"

	code=$(post_remove_with "$good" "Origin: null")
	assert_eq "Origin: null (a sandboxed or redirected page) is refused" "$code" 500
	assert_eq "Origin: null: the action never reached the API" "$(api_count '"method":"DELETE"')" 0

	code=$(post_remove_with "$good" "Origin: $panel")
	assert_eq "the panel's own Origin is accepted" "$code" 200
	assert_eq "the panel's own Origin reaches the API once" "$(api_count '"method":"DELETE"')" 1

	# Measured, not endorsed: Next takes the host from X-Forwarded-Host when it is
	# present, so a request that carries a foreign Origin and the same foreign
	# X-Forwarded-Host passes the check. The panel has no check of its own, so the
	# README's rule (the proxy overwrites X-Forwarded-Host) is the whole defence.
	# These two lines pin that dependency: if they start failing the panel has
	# gained its own defence, and the README and docs/maintainers/e2e.md change.
	code=$(post_remove_with "$good" "Origin: https://evil.test" "X-Forwarded-Host: evil.test")
	assert_eq "measured: a matching foreign Origin and X-Forwarded-Host passes Next's check" "$code" 200
	assert_eq "measured: and the action reaches the API" "$(api_count '"method":"DELETE"')" 1

	# The sign-in form works without script, so a browser posts it itself, and
	# what it sends as Origin follows the page's Referrer-Policy: the panel's own
	# origin under `same-origin`, `null` under `no-referrer`. The second is
	# refused like any other `null`, which is how the form answered 500 in a
	# browser with script off while every check here, posting with curl and no
	# Origin, passed.
	fresh
	local out
	login_extra=(-H "Origin: $panel")
	out=$(post_login admin correct-horse "$work/h" "$work/b")
	assert_eq "the sign-in form, posted as a browser posts it under same-origin, signs in" "${out% *}" 303
	assert_contains "and sets the session" "$(cat "$work/h")" "$SESSION_COOKIE_NAME="
	login_extra=(-H "Origin: null")
	out=$(post_login admin correct-horse "$work/h" "$work/b")
	assert_eq "the same form with Origin: null, as under no-referrer, is refused" "${out% *}" 500
	assert_absent "and sets no session" "$(cat "$work/h")" "$SESSION_COOKIE_NAME="
	login_extra=()
	fetch /
	assert_eq "so the sign-in page asks for same-origin" "$(header referrer-policy)" same-origin
}
