# shellcheck shell=bash disable=SC2154,SC2034
# Scenario captcha of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.
#
# The CAPTCHA is a stand-in provider served by the stand-in API and described to
# the panel through the `custom` provider. The two constants below equal the
# stand-in's (`scripts/e2e/html-checks.test.ts` asserts it).

CAPTCHA_SOLVED_TOKEN="stand-in-solved-token"
CAPTCHA_SECRET="stand-in-captcha-secret"

# captcha_env SECRET_FILE: the environment of a panel with the stand-in provider on.
captcha_env() {
	panel_env=(
		"EPISTLE_PANEL_CAPTCHA_PROVIDER=custom"
		"EPISTLE_PANEL_CAPTCHA_SITE_KEY=stand-in-site-key"
		"EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE=$1"
		"EPISTLE_PANEL_CAPTCHA_SCRIPT_URL=$api/__captcha/widget.js"
		"EPISTLE_PANEL_CAPTCHA_VERIFY_URL=$api/__captcha/verify"
		"EPISTLE_PANEL_CAPTCHA_RESPONSE_FIELD=stand-in-captcha-response"
	)
}

# provider_calls: how many verification calls the stand-in provider has seen.
provider_calls() {
	api_count '"path":"/__captcha/verify"'
}

# normalised_csp CSP: the policy with its nonce replaced, to compare two of them.
normalised_csp() {
	printf '%s' "$1" | sed "s/'nonce-[^']*'/'nonce-N'/g"
}

scenario_captcha() {
	echo "# sign-in CAPTCHA: off by default, verified before the API, fail closed, CSP widened for one origin"
	fresh
	local baseline csp origin
	origin=$api
	fetch /
	baseline=$(normalised_csp "$(header content-security-policy)")
	assert_absent "off by default: the sign-in page has no widget" "$(cat "$work/b")" "captcha-widget"
	login admin correct-horse
	assert_eq "off by default: sign-in works without a token" "$status" 303

	write_secret "$CAPTCHA_SECRET" "$work/secrets/captcha-secret"
	captcha_env "$work/secrets/captcha-secret"
	start_panel
	reset_api

	fetch /
	assert_eq "on: the sign-in page renders" "$status" 200
	assert_contains "on: the page carries the widget box" "$(cat "$work/b")" "captcha-widget"
	assert_contains "on: the page carries the public site key" "$(cat "$work/b")" "stand-in-site-key"
	assert_contains "on: the page names the widget script" "$(cat "$work/b")" "__captcha/widget.js"
	assert_absent "on: the page never holds the secret key" "$(cat "$work/b")" "$CAPTCHA_SECRET"
	assert_absent "on: the page never names the verification endpoint" "$(cat "$work/b")" "__captcha/verify"
	csp=$(header content-security-policy)
	assert_contains "CSP: script-src gained the provider's origin" "$(printf '%s' "$csp" | tr ';' '\n' | grep script-src)" "$origin"
	assert_contains "CSP: frame-src is the provider's origin" "$(printf '%s' "$csp" | tr ';' '\n' | grep frame-src)" "$origin"
	assert_contains "CSP: connect-src gained the provider's origin" "$(printf '%s' "$csp" | tr ';' '\n' | grep connect-src)" "$origin"
	assert_eq "CSP: nothing else changed" \
		"$(normalised_csp "$csp" | sed "s# $origin##g; s#; frame-src 'self'##")" "$baseline"
	assert_absent "CSP: still no unsafe-inline" "$csp" "unsafe-inline"
	assert_eq "on: still no inline style attribute or element" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0

	login admin correct-horse
	assert_eq "no token: sign-in is refused" "$status" 200
	assert_eq "no token: no session cookie" "$cookie" ""
	assert_eq "no token: the provider was not asked" "$(provider_calls)" 0
	assert_eq "no token: the API was not asked" "$(api_count '"path":"/api/v1/auth/verify"')" 0

	login_extra=(-F "captcha=not-solved")
	login admin correct-horse
	assert_eq "unsolved token: sign-in is refused" "$status" 200
	assert_eq "unsolved token: no session cookie" "$cookie" ""
	assert_eq "unsolved token: the provider was asked once" "$(provider_calls)" 1
	assert_eq "unsolved token: the API was not asked" "$(api_count '"path":"/api/v1/auth/verify"')" 0
	assert_contains "unsolved token: the provider saw the right secret" "$(api_log)" '"secret":"valid","token":"unsolved"'

	login_extra=(-F "captcha=$CAPTCHA_SOLVED_TOKEN")
	login admin correct-horse
	assert_eq "solved token: sign-in is accepted" "$status" 303
	assert_contains "solved token: a session cookie is set" "$cookie" "$SESSION_COOKIE_NAME="
	assert_eq "solved token: the provider was asked again" "$(provider_calls)" 2
	assert_eq "solved token: the API was asked once" "$(api_count '"path":"/api/v1/auth/verify"')" 1
	fetch "$adm" "$cookie"
	assert_eq "the signed-in page renders" "$status" 200
	assert_absent "the signed-in page's CSP is not widened" "$(header content-security-policy)" "$origin"
	fetch /app/mail
	assert_eq "a redirect is not widened either" "$status" 307
	assert_absent "the redirect's CSP is not widened" "$(header content-security-policy)" "$origin"

	assert_absent "the panel's log holds no token" "$(cat "$work/panel.log")" "$CAPTCHA_SOLVED_TOKEN"
	assert_absent "the panel's log holds no secret" "$(cat "$work/panel.log")" "$CAPTCHA_SECRET"
	assert_absent "the provider's log holds no secret or token" "$(api_log)" "$CAPTCHA_SECRET"
	assert_absent "the provider's log holds no token" "$(api_log)" "$CAPTCHA_SOLVED_TOKEN"

	# Misconfigured: a provider is named but the setup is not usable. Sign-in is
	# refused whatever the token, the log says which variable, and the policy is
	# not widened for a widget that will not draw.
	captcha_env "$work/secrets/does-not-exist"
	start_panel
	reset_api
	login admin correct-horse
	assert_eq "unreadable secret: sign-in is refused even with a solved token" "$cookie" ""
	assert_eq "unreadable secret: the provider was not asked" "$(provider_calls)" 0
	assert_eq "unreadable secret: the API was not asked" "$(api_count '"path":"/api/v1/auth/verify"')" 0
	assert_contains "unreadable secret: the log names the variable" "$(cat "$work/panel.log")" "EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE"
	assert_contains "unreadable secret: the log says sign-in is refused" "$(cat "$work/panel.log")" "sign-in is refused until it is fixed"
	assert_absent "unreadable secret: the log has no path" "$(cat "$work/panel.log")" "does-not-exist"

	panel_env=("EPISTLE_PANEL_CAPTCHA_PROVIDER=turnstile" "EPISTLE_PANEL_CAPTCHA_SECRET_KEY_FILE=$work/secrets/captcha-secret")
	start_panel
	login admin correct-horse
	assert_eq "no site key: sign-in is refused even with a solved token" "$cookie" ""
	assert_contains "no site key: the log names the variable" "$(cat "$work/panel.log")" "EPISTLE_PANEL_CAPTCHA_SITE_KEY"
	fetch /
	assert_absent "no site key: no widget is drawn" "$(cat "$work/b")" "captcha-widget"
	assert_eq "no site key: the policy is not widened" "$(normalised_csp "$(header content-security-policy)")" "$baseline"

	panel_env=("EPISTLE_PANEL_CAPTCHA_PROVIDER=friendly")
	start_panel
	login admin correct-horse
	assert_eq "unknown provider: sign-in is refused" "$cookie" ""
	assert_contains "unknown provider: the log names the variable" "$(cat "$work/panel.log")" "EPISTLE_PANEL_CAPTCHA_PROVIDER"

	login_extra=()
	panel_env=()
}
