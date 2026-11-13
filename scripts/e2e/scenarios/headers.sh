# shellcheck shell=bash disable=SC2154,SC2034
# Scenario headers of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_headers() {
	echo "# headers, nonce and session cookie"
	fresh
	local csp1 csp2 nonce1 nonce2 html
	fetch /
	assert_eq "GET / (the sign-in page)" "$status" 200
	csp1=$(header content-security-policy)
	html=$(cat "$work/b")
	nonce1=$(nonce_of_csp "$csp1")
	assert_contains "CSP has script-src with nonce and strict-dynamic" "$csp1" "'strict-dynamic'"
	assert_contains "CSP forbids framing" "$csp1" "frame-ancestors 'none'"
	assert_absent "CSP has no unsafe-inline" "$csp1" "unsafe-inline"
	assert_absent "CSP has no unsafe-eval in production" "$csp1" "unsafe-eval"
	assert_contains "the nonce in the CSP is the one on the scripts" "$html" "nonce=\"$nonce1\""
	assert_eq "no script tag without the nonce, whatever its attributes" "$(unnonced_scripts "$work/b" "$nonce1")" 0
	assert_eq "x-frame-options" "$(header x-frame-options)" DENY
	assert_eq "x-content-type-options" "$(header x-content-type-options)" nosniff
	assert_eq "referrer-policy" "$(header referrer-policy)" no-referrer
	assert_eq "x-robots-tag on the login page" "$(header x-robots-tag)" "noindex, nofollow, noarchive, nosnippet, noimageindex"
	assert_contains "permissions-policy denies the camera" "$(header permissions-policy)" "camera=()"
	assert_eq "x-powered-by is absent" "$(header x-powered-by)" ""
	fetch /
	csp2=$(header content-security-policy)
	nonce2=$(nonce_of_csp "$csp2")
	if [[ -n "$nonce1" && "$nonce1" != "$nonce2" ]]; then
		ok "the nonce changes on every request"
	else
		not_ok "the nonce changes on every request" "'$nonce1' vs '$nonce2'"
	fi

	local css
	css=$(printf '%s' "$html" | { grep -o '/_next/static/[^"]*\.css' || true; } | head -1)
	fetch "$css"
	assert_eq "static asset" "$status" 200
	assert_eq "static asset keeps nosniff" "$(header x-content-type-options)" nosniff
	assert_eq "static asset carries x-robots-tag" "$(header x-robots-tag)" "noindex, nofollow, noarchive, nosnippet, noimageindex"
	assert_absent "the stylesheet wires no font variable that nothing defines" "$(cat "$work/b")" "font-geist"
	assert_contains "the stylesheet carries the system font stack" "$(cat "$work/b")" "--font-mono:ui-monospace"

	login admin correct-horse
	assert_eq "login success redirects" "$status" 303
	local set_cookie
	set_cookie=$({ grep -i '^set-cookie: __Host-' "$work/h" || true; } | tr -d '\r')
	assert_contains "cookie is __Host- prefixed" "$set_cookie" "$SESSION_COOKIE_NAME="
	assert_contains "cookie is Secure" "$set_cookie" "; Secure"
	assert_contains "cookie is HttpOnly" "$set_cookie" "; HttpOnly"
	assert_contains "cookie has Path=/" "$set_cookie" "; Path=/"
	assert_contains "cookie is SameSite=Lax" "${set_cookie,,}" "samesite=lax"
	assert_contains "cookie has Max-Age of 8 hours" "$set_cookie" "Max-Age=28800"
	assert_absent "cookie has no Domain" "${set_cookie,,}" "domain="

	local path
	for path in "$adm" "$adm/accounts" "$adm/domains" "$adm/queue" "$adm/suppression" "$adm/deliveries"; do
		fetch "$path" "$cookie"
		assert_eq "GET $path with a session" "$status" 200
		nonce1=$(nonce_of_csp "$(header content-security-policy)")
		assert_contains "$path: nonce on its scripts" "$(cat "$work/b")" "nonce=\"$nonce1\""
		assert_eq "$path: no script tag without the nonce" "$(unnonced_scripts "$work/b" "$nonce1")" 0
		assert_eq "$path: no inline style attribute or element" \
			"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
		assert_eq "$path: x-robots-tag" "$(header x-robots-tag)" "noindex, nofollow, noarchive, nosnippet, noimageindex"
		assert_contains "$path: robots meta tag" "$(cat "$work/b")" '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex"'
		assert_absent "$path: no canonical link" "$(cat "$work/b")" 'rel="canonical"'
		assert_absent "$path: no Open Graph or Twitter tags" "$(cat "$work/b")" 'property="og:'
		assert_absent "$path: no Twitter card" "$(cat "$work/b")" 'name="twitter:'
		assert_absent "$path: not the unreachable alert" "$(cat "$work/b")" 'role="alert"'
		# The 404 page's own text is in every page's route payload, so look for the
		# catalog of its namespace, which only reaches the browser if it is a client one.
		assert_absent "$path: no server-only catalog in the client payload" "$(cat "$work/b")" 'notFound\":{'
		assert_contains "$path: a client catalog is in the payload" "$(cat "$work/b")" 'table\":{'
		assert_contains "$path: the client strings are in the payload" "$(cat "$work/b")" "Could not remove the message"
	done

	fetch /app/mail "$cookie"
	assert_eq "the mail area with a session" "$status" 200
	nonce1=$(nonce_of_csp "$(header content-security-policy)")
	assert_eq "mail: no script tag without the nonce" "$(unnonced_scripts "$work/b" "$nonce1")" 0
	assert_eq "mail: no inline style attribute or element" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	assert_eq "mail: x-robots-tag" "$(header x-robots-tag)" "noindex, nofollow, noarchive, nosnippet, noimageindex"
	assert_contains "mail: an admin session is offered the way into the admin area" "$(cat "$work/b")" "href=\"$adm\""

	fetch /does-not-exist "$cookie"
	assert_eq "unknown path with a session" "$status" 404
	assert_eq "404 page: no inline style attribute or element" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
}
