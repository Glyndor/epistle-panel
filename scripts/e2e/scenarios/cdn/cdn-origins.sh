# shellcheck shell=bash disable=SC2154,SC2034
# Scenario cdn-origins of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.
#
# The static origin is compiled into the build, and `run.sh` does not build, so
# this scenario checks what a real server does at run time: the brand origin in
# the policy and the markup, the policy untouched without it, and the refusal to
# start for a value that is not one exact https origin or for a static origin
# the build was not made for. The page loading from a second origin with zero
# violations was measured in a real browser and is written up in
# docs/maintainers/customising.md; no check here can reach an https origin.

# The policy without its nonce and without `img-src`, one directive per line.
cdn_csp_rest() {
	printf '%s' "$1" | sed "s/'nonce-[^']*'/'nonce-N'/g" | tr ';' '\n' |
		sed 's/^ *//' | { grep -v '^img-src ' || true; }
}

# cdn_start_refused ENV...: start the server in the foreground with these
# variables on top of the usual ones. Sets `refused_status` to its exit status
# (124 when it kept running until the timeout) and `refused_log` to what it said.
cdn_start_refused() {
	local port
	port=$(free_port)
	refused_status=0
	refused_log=$(
		cd "$standalone" &&
			timeout 20 env -i PATH="$PATH" NODE_ENV=production PORT="$port" \
				HOSTNAME=127.0.0.1 NEXT_TELEMETRY_DISABLED=1 \
				EPISTLE_API_URL="$api" \
				EPISTLE_API_TOKEN_FILE="$api_token_file" \
				EPISTLE_PANEL_SESSION_SECRET_FILE="$session_secret_file" \
				EPISTLE_PANEL_ADMIN_ID="$panel_admin_id" \
				"$@" node server.js 2>&1
	) || refused_status=$?
}

scenario_cdn_origins() {
	echo "# content delivery origins: the policy changes only with them, and a wrong value stops the start"
	fresh
	local csp_plain body
	fetch /
	csp_plain=$(header content-security-policy)
	body=$(cat "$work/b")
	assert_contains "no origin: img-src is the panel and data URLs" "$csp_plain" "img-src 'self' data:; font-src 'self'"
	assert_absent "no origin: the markup points at no other origin" "$(printf '%s' "$body" | { grep -o -E '(src|href)="https?://[^"]*"' || true; })" "http"
	assert_absent "no origin: the policy names no host" "$csp_plain" "https://"

	local dir=$work/cdn-brand origin=https://cdn.e2e-origin.test:8443
	mkdir "$dir"
	printf '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/></svg>' >"$dir/logo.svg"
	printf '\x00\x00\x01\x00\x01\x00' >"$dir/favicon.ico"
	panel_env=(
		"EPISTLE_PANEL_BRAND_LOGO_FILE=$dir/logo.svg"
		"EPISTLE_PANEL_BRAND_FAVICON_FILE=$dir/favicon.ico"
		"EPISTLE_PANEL_BRAND_ORIGIN=${origin^^}/"
	)
	start_panel
	fetch /
	local csp_brand
	csp_brand=$(header content-security-policy)
	body=$(cat "$work/b")
	assert_eq "brand origin: the page is served" "$status" 200
	assert_contains "brand origin: img-src gains that one origin, in lower case" "$csp_brand" "img-src 'self' data: $origin;"
	assert_eq "brand origin: no other directive changes" "$(cdn_csp_rest "$csp_brand")" "$(cdn_csp_rest "$csp_plain")"
	assert_absent "brand origin: no unsafe-inline and no wildcard" "$csp_brand" "unsafe-inline"
	assert_absent "brand origin: no wildcard" "$csp_brand" "*"
	assert_contains "brand origin: the logo is asked of that origin" "$body" "src=\"$origin/brand/logo\""
	assert_contains "brand origin: so is the favicon" "$body" "href=\"$origin/brand/favicon\""
	fetch /brand/logo
	assert_eq "brand origin: the panel still serves the logo from its disk" "$status" 200
	fetch /brand/favicon
	assert_eq "brand origin: and the favicon" "$status" 200
	panel_env=()

	local bad
	for bad in "http://cdn.e2e-origin.test" "https://*.e2e-origin.test" "https://cdn.e2e-origin.test/assets" \
		"https://user:pass@cdn.e2e-origin.test" "https://cdn.e2e-origin.test;img-src"; do
		cdn_start_refused "EPISTLE_PANEL_BRAND_ORIGIN=$bad"
		assert_eq "a brand origin that is not one exact https origin stops the start" "$refused_status" 1
		assert_contains "and the message names the variable" "$refused_log" "EPISTLE_PANEL_BRAND_ORIGIN is set to a value that is not one exact https origin"
		assert_absent "and never repeats the value" "$refused_log" "e2e-origin"
	done

	cdn_start_refused "EPISTLE_PANEL_STATIC_ORIGIN=$origin"
	assert_eq "a static origin on a build made without one stops the start" "$refused_status" 1
	assert_contains "and the message says the variable is read when the image is built" "$refused_log" "EPISTLE_PANEL_STATIC_ORIGIN is set, but this build serves its static files itself"
	assert_absent "and never repeats the value" "$refused_log" "e2e-origin"
	cdn_start_refused "EPISTLE_PANEL_STATIC_ORIGIN=http://cdn.e2e-origin.test"
	assert_eq "an unusable static origin stops the start" "$refused_status" 1
	assert_contains "and the message names the variable" "$refused_log" "EPISTLE_PANEL_STATIC_ORIGIN is set to a value that is not one exact https origin"
	assert_absent "and the other names no value either" "$refused_log" "e2e-origin"

	start_panel
	fetch /
	assert_eq "with neither variable the panel starts and serves again" "$status" 200
	assert_eq "and its policy is the one it started with" "$(cdn_csp_rest "$(header content-security-policy)")" "$(cdn_csp_rest "$csp_plain")"
}
