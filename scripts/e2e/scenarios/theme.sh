# shellcheck shell=bash disable=SC2154,SC2034
# Scenario theme of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_theme() {
	echo "# operator theme and branding: public, exact, and the CSP does not widen"
	fresh
	local csp_before csp_after
	fetch /theme.css
	assert_eq "no theme configured: /theme.css is a 404" "$status" 404
	fetch /brand/logo
	assert_eq "no logo configured: /brand/logo is a 404" "$status" 404
	fetch /login
	assert_absent "no theme configured: the page links no stylesheet of the operator's" "$(cat "$work/b")" 'href="/theme.css"'
	csp_before=$(header content-security-policy)

	local dir=$work/brand
	mkdir "$dir"
	printf ':root{--radius:0.75rem}\n/* e2e-theme-marker */\n' >"$dir/theme.css"
	printf '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>' >"$dir/logo.svg"
	printf '\x00\x00\x01\x00\x01\x00' >"$dir/favicon.ico"
	panel_env=(
		"EPISTLE_PANEL_THEME_CSS_FILE=$dir/theme.css"
		"EPISTLE_PANEL_BRAND_NAME=Acme Mail"
		"EPISTLE_PANEL_BRAND_LOGO_FILE=$dir/logo.svg"
		"EPISTLE_PANEL_BRAND_FAVICON_FILE=$dir/favicon.ico"
	)
	start_panel

	fetch /theme.css
	assert_eq "theme: /theme.css answers without a session" "$status" 200
	assert_contains "theme: content type is CSS" "$(header content-type)" "text/css"
	assert_contains "theme: a short cache lifetime" "$(header cache-control)" "max-age=60"
	assert_eq "theme: nosniff" "$(header x-content-type-options)" nosniff
	assert_eq "theme: x-robots-tag" "$(header x-robots-tag)" "noindex, nofollow, noarchive, nosnippet, noimageindex"
	assert_contains "theme: the operator's stylesheet is served" "$(cat "$work/b")" "e2e-theme-marker"

	fetch /login
	assert_contains "theme: the sign-in page links the stylesheet" "$(cat "$work/b")" 'href="/theme.css"'
	assert_contains "brand: the sign-in page shows the operator's name" "$(cat "$work/b")" "Acme Mail"
	assert_contains "brand: the sign-in page shows the operator's logo" "$(cat "$work/b")" 'src="/brand/logo"'
	assert_contains "brand: the original copyright notice stays" "$(cat "$work/b")" "© 2026 Glyndor"
	csp_after=$(header content-security-policy)
	assert_eq "theme: the CSP is the same as without a theme" "$(printf '%s' "$csp_after" | sed "s/'nonce-[^']*'/'nonce-N'/")" "$(printf '%s' "$csp_before" | sed "s/'nonce-[^']*'/'nonce-N'/")"
	assert_absent "theme: still no unsafe-inline" "$csp_after" "unsafe-inline"
	assert_eq "theme: still no inline style on the page" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0

	fetch /brand/logo
	assert_eq "brand: /brand/logo answers without a session" "$status" 200
	assert_eq "brand: the logo's type" "$(header content-type)" "image/svg+xml"
	assert_contains "brand: the logo is served under a sandboxing policy" "$(header content-security-policy)" "sandbox"
	assert_eq "brand: logo nosniff" "$(header x-content-type-options)" nosniff
	fetch /brand/favicon
	assert_eq "brand: /brand/favicon answers without a session" "$status" 200
	assert_eq "brand: the favicon's type" "$(header content-type)" "image/x-icon"

	local path
	for path in /theme.cssx /theme.css/queue /x/theme.css /THEME.CSS /brand /brand/logox /brand/logo/x /brand/favicon.ico; do
		fetch "$path"
		assert_eq "theme: $path stays behind the gate" "$status" 307
	done

	# An unusable file is a 404 and a log line that names the variable, not the path.
	ln -s "$dir/theme.css" "$dir/link.css"
	head -c 200000 /dev/zero | tr '\0' 'a' >"$dir/big.css"
	for bad in "$dir/link.css" "$dir/big.css" "$dir/missing.css"; do
		panel_env=("EPISTLE_PANEL_THEME_CSS_FILE=$bad")
		start_panel
		fetch /theme.css
		assert_eq "theme: $(basename "$bad") is refused with a 404" "$status" 404
		assert_absent "theme: the 404 body says nothing about the file" "$(cat "$work/b")" "$dir"
		assert_contains "theme: the log names the variable" "$(cat "$work/panel.log")" "EPISTLE_PANEL_THEME_CSS_FILE is set but"
		assert_absent "theme: the log has no path" "$(cat "$work/panel.log")" "$dir"
	done
	printf '<svg><script>alert(1)</script></svg>' >"$dir/evil.svg"
	panel_env=("EPISTLE_PANEL_BRAND_LOGO_FILE=$dir/evil.svg")
	start_panel
	fetch /brand/logo
	assert_eq "brand: an SVG that carries script is refused" "$status" 404
	panel_env=()
}
