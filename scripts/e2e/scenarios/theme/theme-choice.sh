# shellcheck shell=bash disable=SC2154,SC2034
# Scenario theme-choice of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# Number of Set-Cookie headers of the last request that name the theme cookie.
theme_cookies_set() {
	{ grep -i '^set-cookie: theme=' "$work/h" || true; } | wc -l | tr -d ' '
}

# The Set-Cookie header of the theme cookie in the last response.
theme_cookie_header() {
	{ grep -i '^set-cookie: theme=' "$work/h" || true; } | head -1 | tr -d '\r'
}

# html_theme: the data-theme attribute of the html element of the last page,
# as written (data-theme="dark"), or nothing when the element has none.
html_theme() {
	{ grep -o '<html[^>]*>' "$work/b" || true; } | head -1 |
		{ grep -o 'data-theme="[^"]*"' || true; }
}

# theme_choices: the choices the panel has, read from the one list in
# internal/src/features/theme/config/choices/index.ts.
theme_choices() {
	node -e '
		const src = require("node:fs").readFileSync(process.argv[1], "utf8");
		const list = /THEME_CHOICES = \[([^\]]*)\]/.exec(src)[1];
		process.stdout.write([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]).join(" "));
	' "$internal/src/features/theme/config/choices/index.ts"
}

scenario_theme_choice() {
	echo "# theme choice: the cookie is painted on the server, a tampered one is ignored, the action is the gate"
	fresh
	set_404_reference

	# --- the sign-in page, no session: the cookie alone decides, and only a choice counts
	fetch /
	assert_eq "no theme cookie: the sign-in page renders" "$status" 200
	assert_eq "no theme cookie: the html element has no data-theme" "$(html_theme)" ""
	normalize_body "$work/b" "$work/h" >"$work/plain.b"
	local csp_plain
	csp_plain=$(header content-security-policy | sed "s/'nonce-[^']*'/'nonce-N'/g")

	local theme
	for theme in light dark; do
		fetch / "theme=$theme"
		assert_eq "theme=$theme: the html element says it in the served page" "$(html_theme)" "data-theme=\"$theme\""
		assert_eq "theme=$theme: no inline style attribute or element" \
			"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
		assert_eq "theme=$theme: no script tag without the nonce" \
			"$(unnonced_scripts "$work/b" "$(nonce_of_csp "$(header content-security-policy)")")" 0
		assert_eq "theme=$theme: the CSP is the same as without the cookie" \
			"$(header content-security-policy | sed "s/'nonce-[^']*'/'nonce-N'/g")" "$csp_plain"
	done
	fetch / "theme=system"
	assert_eq "theme=system: no data-theme, the stylesheet follows the browser" "$(html_theme)" ""

	local hostile
	for hostile in 'DARK' 'Dark' 'LIGHT' 'auto' 'dark%20' 'dark light' 'dark,light' 'e2emarker-dark' \
		'dark-e2emarker' '"dark"' 'dark"e2emarker="1' '"><e2emarker>' '../dark' '__proto__' \
		"$(printf 'd%.0s' $(seq 1 3000))e2emarker"; do
		fetch / "theme=$hostile"
		assert_eq "a tampered theme cookie ${hostile:0:20}: the page still renders" "$status" 200
		assert_eq "a tampered theme cookie ${hostile:0:20}: no data-theme" "$(html_theme)" ""
		if [[ "$(normalize_body "$work/b" "$work/h")" == "$(cat "$work/plain.b")" ]]; then
			ok "a tampered theme cookie ${hostile:0:20}: the page is the one of no cookie, byte for byte but the nonce"
		else
			not_ok "a tampered theme cookie ${hostile:0:20}: the page is the one of no cookie, byte for byte but the nonce"
		fi
	done

	# --- signed in: the admin area and the mail area paint it too, and show it on the button
	login admin correct-horse
	local good=$cookie code path
	for path in "$adm" "$adm/queue" /app/mail; do
		fetch "$path" "$good; theme=dark"
		assert_eq "GET $path with theme=dark" "$status" 200
		assert_eq "$path: the html element says dark" "$(html_theme)" 'data-theme="dark"'
		assert_contains "$path: the theme button is rendered with the choice" "$(cat "$work/b")" 'data-theme-choice="dark"'
		assert_eq "$path: no inline style attribute or element" \
			"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
		fetch "$path" "$good; theme=\"><e2emarker>"
		assert_eq "$path with a tampered cookie: no data-theme" "$(html_theme)" ""
		assert_absent "$path with a tampered cookie: nothing of it in the page" "$(cat "$work/b")" "e2emarker"
		assert_contains "$path with a tampered cookie: the button says system" "$(cat "$work/b")" 'data-theme-choice="system"'
	done

	# --- the framed body of a message is a document of its own: the page tells it the theme in its address
	fetch "/app/mail/body/$MAIL_NEWSLETTER" "$good"
	assert_eq "the framed body without a theme renders" "$status" 200
	assert_contains "the framed body without a theme follows the browser" "$(cat "$work/b")" 'name="color-scheme" content="light dark"'
	for theme in light dark; do
		fetch "/app/mail/body/$MAIL_NEWSLETTER?theme=$theme" "$good"
		assert_contains "the framed body asked for $theme is in that theme" "$(cat "$work/b")" "name=\"color-scheme\" content=\"$theme\""
		fetch "/app/mail/body/$MAIL_NEWSLETTER?images=1&theme=$theme" "$good"
		assert_contains "the framed body with images asked for $theme is in that theme" "$(cat "$work/b")" "name=\"color-scheme\" content=\"$theme\""
	done
	for hostile in 'DARK' 'dark%20light' 'dark%22%3E%3Ce2emarker%3E' 'system' 'dark&theme=light' ''; do
		fetch "/app/mail/body/$MAIL_NEWSLETTER?theme=$hostile" "$good"
		assert_eq "the framed body asked for ${hostile:0:16}, which is no theme, still renders" "$status" 200
		if [[ "$hostile" == 'dark&theme=light' ]]; then
			# Two values: the first one counts, and it is a theme.
			assert_contains "the framed body takes the first of two values" "$(cat "$work/b")" 'name="color-scheme" content="dark"'
		else
			assert_contains "the framed body asked for ${hostile:0:16} follows the browser" "$(cat "$work/b")" 'name="color-scheme" content="light dark"'
		fi
		assert_absent "the framed body asked for ${hostile:0:16} carries nothing of it" "$(cat "$work/b")" "e2emarker"
	done
	fetch "/app/mail/body/$MAIL_NEWSLETTER" "$good; theme=dark"
	assert_contains "the framed body does not read the theme cookie: only its address counts" "$(cat "$work/b")" 'name="color-scheme" content="light dark"'
	fetch "/app/mail/body/$MAIL_NEWSLETTER?theme=dark"
	assert_eq "the framed body asked for a theme without a session is still denied" "$status" 307

	# --- the Server Action: only a choice is stored
	local file=features/theme/actions/set-theme/index.ts
	for hostile in '["DARK"]' '["Dark"]' '["auto"]' '["dark "]' '["light dark"]' '["../dark"]' '["dark; Path=/"]' \
		'["__proto__"]' '[""]' '[null]' '[1]' '[["dark"]]' '[{"value":"dark"}]' '[]' \
		"[\"$(printf 'd%.0s' $(seq 1 5000))\"]"; do
		code=$(post_action "$file" "$hostile" "$good")
		assert_contains "a value that is not a choice ${hostile:0:24} answers false" "$(cat "$work/b")" '1:false'
		assert_eq "a value that is not a choice ${hostile:0:24} writes no theme cookie" "$(theme_cookies_set)" 0
	done

	local set
	for theme in $(theme_choices); do
		code=$(post_action "$file" "[\"$theme\"]" "$good")
		assert_contains "$theme: a choice answers true" "$(cat "$work/b")" '1:true'
		assert_eq "$theme: a choice writes the theme cookie once" "$(theme_cookies_set)" 1
		set=$(theme_cookie_header)
		assert_contains "$theme: the cookie holds the choice" "$set" "theme=$theme;"
		assert_contains "$theme: the cookie is Secure" "$set" "; Secure"
		assert_contains "$theme: the cookie has Path=/" "$set" "; Path=/"
		assert_contains "$theme: the cookie is SameSite=Lax" "${set,,}" "samesite=lax"
		assert_contains "$theme: the cookie lasts a year" "$set" "Max-Age=31536000"
		assert_absent "$theme: the cookie has no Domain" "${set,,}" "domain="
	done

	# --- a user who is not an admin has the same control in the mail area
	login user plain-staple
	local user=$cookie
	action_page=/app/mail
	code=$(post_action "$file" '["dark"]' "$user")
	assert_contains "a user session: a choice answers true" "$(cat "$work/b")" '1:true'
	assert_eq "a user session: the theme cookie is written" "$(theme_cookies_set)" 1
	code=$(post_action "$file" '["DARK"]' "$user")
	assert_contains "a user session: a value that is not a choice answers false" "$(cat "$work/b")" '1:false'
	assert_eq "a user session: and writes nothing" "$(theme_cookies_set)" 0
	action_page=
	fetch /app/mail "$user; theme=light"
	assert_eq "a user session: the mail area says light" "$(html_theme)" 'data-theme="light"'

	# --- no session: the action is what a missing path answers, and writes nothing
	code=$(post_action "$file" '["dark"]')
	assert_eq "no session: the action is what a missing path answers" "$code" "$ref_action_status"
	assert_eq "no session: no theme cookie" "$(theme_cookies_set)" 0
	code=$(post_action "$file" '["DARK"]')
	assert_eq "no session and a value that is not a choice: the same" "$code" "$ref_action_status"
	assert_eq "no session and a value that is not a choice: no theme cookie" "$(theme_cookies_set)" 0
}
