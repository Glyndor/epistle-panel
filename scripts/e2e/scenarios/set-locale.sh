# shellcheck shell=bash disable=SC2154,SC2034
# Scenario set-locale of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# Number of Set-Cookie headers of the last request that name the locale cookie.
locale_cookies_set() {
	{ grep -i '^set-cookie: locale=' "$work/h" || true; } | wc -l | tr -d ' '
}

scenario_set_locale() {
	echo "# set-locale Server Action: a language the panel does not have changes nothing"
	fresh
	login admin correct-horse
	local good=$cookie code
	local file=features/locale/actions/set-locale/index.ts
	reset_api

	code=$(post_action "$file" '["xx"]' "$good")
	assert_eq "an unknown language with a session: the action runs" "$code" 200
	assert_contains "an unknown language answers false" "$(cat "$work/b")" '1:false'
	assert_eq "an unknown language writes no locale cookie" "$(locale_cookies_set)" 0

	code=$(post_action "$file" '["../es"]' "$good")
	assert_contains "a path-like language answers false" "$(cat "$work/b")" '1:false'
	assert_eq "a path-like language writes no locale cookie" "$(locale_cookies_set)" 0

	code=$(post_action "$file" '["es"]' "$good")
	assert_contains "a language the panel has answers true" "$(cat "$work/b")" '1:true'
	assert_eq "a language the panel has writes the locale cookie" "$(locale_cookies_set)" 1

	code=$(post_action "$file" '["es"]')
	assert_eq "no session: the action is redirected to the sign-in" "$code" 307
	assert_eq "no session: no locale cookie" "$(locale_cookies_set)" 0
	code=$(post_action "$file" '["xx"]')
	assert_eq "no session and an unknown language: redirected too" "$code" 307
	assert_eq "no session and an unknown language: no locale cookie" "$(locale_cookies_set)" 0
}
