#!/usr/bin/env bash
# End-to-end checks of the built standalone panel against a stand-in epistle API.
#
# What it proves, over real HTTP, that the unit tests cannot: the headers and
# the session cookie a real server emits, logout revoking a token across the
# proxy, the pages and the actions, the sign-in limiter, the denial of every
# route and Server Action without a session, the API timeout and size cap, the
# `_FILE` secret cache, and the server's memory after a burst of requests. The
# browser-only checks are listed in docs/maintainers/e2e.md.
#
# Run `bun run build` in internal/ first. Needs bash, node, bun and curl, and
# talks only to 127.0.0.1. It is not part of the default CI.
#
# Usage: scripts/e2e/run.sh [scenario...]
#   scenarios: headers logout limiter limiter-global noauth degraded rotation idle
# With no argument every scenario runs. Exit status is non-zero when any check
# fails. Override the ports with PANEL_PORT and STAND_IN_PORT.
set -euo pipefail

root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
# shellcheck source=scripts/e2e/session-cookie.sh
. "$root/scripts/e2e/session-cookie.sh"
# shellcheck source=scripts/e2e/html-checks.sh
. "$root/scripts/e2e/html-checks.sh"
internal="$root/internal"
standalone="$internal/.next/standalone"

if [[ ! -f "$standalone/server.js" ]]; then
	echo "error: $standalone/server.js is missing, run 'bun run build' in internal/ first" >&2
	exit 1
fi

port_in_use() {
	(exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null
}

free_port() {
	local port
	for _ in $(seq 1 50); do
		port=$((20000 + RANDOM % 20000))
		if ! port_in_use "$port"; then
			echo "$port"
			return
		fi
	done
	echo "error: no free port found" >&2
	exit 1
}

panel_port=${PANEL_PORT:-$(free_port)}
stand_in_port=${STAND_IN_PORT:-$(free_port)}
panel="http://127.0.0.1:$panel_port"
api="http://127.0.0.1:$stand_in_port"

work=$(mktemp -d)
chmod 700 "$work"
mkdir "$work/secrets"
api_token_file="$work/secrets/api-token"
session_secret_file="$work/secrets/session-secret"
panel_pid=""
stand_in_pid=""
passed=0
failed=0

stop_pid() {
	if [[ -n "$1" ]]; then
		kill "$1" 2>/dev/null || true
		wait "$1" 2>/dev/null || true
	fi
}

cleanup() {
	stop_pid "$panel_pid"
	stop_pid "$stand_in_pid"
	rm -rf "$work"
}
trap cleanup EXIT INT TERM

# `next build` leaves the static assets out of the standalone folder; the
# container image copies them in the same way.
mkdir -p "$standalone/.next"
rm -rf "$standalone/.next/static"
cp -R "$internal/.next/static" "$standalone/.next/static"

# ---------------------------------------------------------------- reporting

ok() {
	passed=$((passed + 1))
	echo "ok - $1"
}

not_ok() {
	failed=$((failed + 1))
	echo "not ok - $1"
	[[ -n "${2:-}" ]] && echo "    $2"
	return 0
}

# assert_eq DESCRIPTION ACTUAL EXPECTED
assert_eq() {
	if [[ "$2" == "$3" ]]; then
		ok "$1 ($2)"
	else
		not_ok "$1" "expected '$3', got '$2'"
	fi
}

# assert_contains DESCRIPTION HAYSTACK NEEDLE
assert_contains() {
	if [[ "$2" == *"$3"* ]]; then
		ok "$1"
	else
		not_ok "$1" "'$3' not found"
	fi
}

# assert_absent DESCRIPTION HAYSTACK NEEDLE
assert_absent() {
	if [[ "$2" != *"$3"* ]]; then
		ok "$1"
	else
		not_ok "$1" "'$3' found"
	fi
}

# assert_between DESCRIPTION VALUE LOW HIGH (decimal seconds)
assert_between() {
	if awk -v v="$2" -v lo="$3" -v hi="$4" 'BEGIN { exit !(v >= lo && v <= hi) }'; then
		ok "$1 (${2}s, expected ${3}s to ${4}s)"
	else
		not_ok "$1" "${2}s is outside ${3}s to ${4}s"
	fi
}

# ---------------------------------------------------------------- processes

write_secret() {
	rm -f "$2"
	printf '%s\n' "$1" >"$2"
	chmod 0400 "$2"
}

start_stand_in() {
	stop_pid "$stand_in_pid"
	STAND_IN_TOKEN="$(tr -d '\n' <"$api_token_file")" STAND_IN_PORT="$stand_in_port" \
		bun "$root/scripts/e2e/stand-in-api/index.ts" >"$work/stand-in.log" 2>&1 &
	stand_in_pid=$!
	wait_http "$api/__control/log"
}

start_panel() {
	stop_pid "$panel_pid"
	(
		cd "$standalone"
		exec env -i PATH="$PATH" NODE_ENV=production PORT="$panel_port" \
			HOSTNAME=127.0.0.1 NEXT_TELEMETRY_DISABLED=1 \
			EPISTLE_API_URL="$api" \
			EPISTLE_API_TOKEN_FILE="$api_token_file" \
			EPISTLE_PANEL_SESSION_SECRET_FILE="$session_secret_file" \
			EPISTLE_PANEL_LOGIN_MIN_MS="${login_min_ms:-1000}" \
			node server.js
	) >"$work/panel.log" 2>&1 &
	panel_pid=$!
	wait_http "$panel/login"
}

wait_http() {
	for _ in $(seq 1 100); do
		if curl -s -o /dev/null "$1"; then
			return
		fi
		sleep 0.1
	done
	echo "error: $1 did not come up" >&2
	exit 1
}

# Fresh secrets, a fresh stand-in and a fresh panel: every scenario starts clean.
fresh() {
	write_secret "stand-in-token-$RANDOM$RANDOM" "$api_token_file"
	write_secret "session-secret-$RANDOM$RANDOM$RANDOM$RANDOM" "$session_secret_file"
	start_stand_in
	start_panel
}

api_log() {
	curl -s "$api/__control/log"
}

# Number of stand-in requests whose logged text matches the fixed string $1.
api_count() {
	{ api_log | grep -o -F "$1" || true; } | wc -l | tr -d ' '
}

verify_calls() {
	api_count '"path":"/api/v1/auth/verify"'
}

set_mode() {
	curl -s -o /dev/null -X POST "$api/__control/mode" -d "{\"mode\":\"$1\"}"
}

reset_api() {
	curl -s -o /dev/null -X POST "$api/__control/reset"
}

# ---------------------------------------------------------------- HTTP helpers

# fetch PATH [COOKIE]: headers to $work/h, body to $work/b, status in $status,
# total time in $elapsed.
fetch() {
	local cookie=()
	[[ -n "${2:-}" ]] && cookie=(-b "$2")
	local out
	out=$(curl -s -D "$work/h" -o "$work/b" -w '%{http_code} %{time_total}' \
		"${cookie[@]}" "$panel$1")
	status=${out% *}
	elapsed=${out#* }
}

# header NAME: value of a response header of the last fetch, case-insensitive.
header() {
	{ grep -i "^$1:" "$work/h" || true; } | head -1 | cut -d: -f2- |
		sed 's/^ *//' | tr -d '\r'
}

# html_field HTML NAME: value of a hidden form field, unescaped.
html_field() {
	local name=${2//\$/\\\$}
	printf '%s' "$1" | { grep -o "name=\"$name\" value=\"[^\"]*\"" || true; } |
		head -1 | sed 's/^[^=]*="[^"]*" value="//; s/"$//; s/&quot;/"/g; s/&amp;/\&/g'
}

# post_login NAME PASSWORD HEADER_FILE BODY_FILE: posts the login form without
# JavaScript and prints the status and the total time.
post_login() {
	local html a0 a1 key
	html=$(curl -s "$panel/login")
	a0=$(html_field "$html" '$ACTION_1:0')
	a1=$(html_field "$html" '$ACTION_1:1')
	key=$(html_field "$html" '$ACTION_KEY')
	curl -s -D "$3" -o "$4" -w '%{http_code} %{time_total}' "$panel/login" \
		-F '$ACTION_REF_1=' -F "\$ACTION_1:0=$a0" -F "\$ACTION_1:1=$a1" \
		-F "\$ACTION_KEY=$key" -F "name=$1" -F "password=$2"
}

# login NAME PASSWORD: sets $status, $elapsed and $cookie (name=value, empty
# when the server set none).
login() {
	local out
	out=$(post_login "$1" "$2" "$work/h" "$work/b")
	status=${out% *}
	elapsed=${out#* }
	cookie=$({ grep -i "^set-cookie: $SESSION_COOKIE_NAME=" "$work/h" || true; } |
		head -1 | sed 's/^[^:]*: //; s/;.*//' | tr -d '\r')
}

# logout_id COOKIE: name of the logout form field in the navigation.
logout_field() {
	curl -s -b "$1" "$panel/" |
		{ grep -o 'name="\$ACTION_ID_[0-9a-f]*"' || true; } | head -1 | sed 's/name="//; s/"$//'
}

# remove_args COOKIE: fills REMOVE_ARGS with the curl -F arguments that submit
# the first Remove form of the queue page, and REMOVE_ID with its entry id.
remove_args() {
	local form n
	form=$(curl -s -b "$1" "$panel/queue" | sed 's/<form/\n<form/g' |
		{ grep 'name="id" value=' || true; } | head -1)
	n=$(printf '%s' "$form" | { grep -o 'ACTION_REF_[0-9]*' || true; } | head -1 | sed 's/ACTION_REF_//')
	REMOVE_ID=$(html_field "$form" 'id')
	REMOVE_FIELD0="\$ACTION_$n:0"
	REMOVE_ARGS=(
		-F "\$ACTION_REF_$n="
		-F "\$ACTION_$n:0=$(html_field "$form" "\$ACTION_$n:0")"
		-F "\$ACTION_$n:1=$(html_field "$form" "\$ACTION_$n:1")"
		-F "\$ACTION_KEY=$(html_field "$form" '$ACTION_KEY')"
		-F "id=$REMOVE_ID"
	)
	REMOVE_ACTION_ID=$(printf '%s' "$form" | { grep -o 'id&quot;:&quot;[0-9a-f]*' || true; } |
		head -1 | sed 's/.*;//')
}

nonce_of_csp() {
	printf '%s' "$1" | { grep -o "'nonce-[^']*'" || true; } | head -1 | sed "s/'nonce-//; s/'$//"
}

rss_kib() {
	awk '/^VmRSS:/ { print $2 }' "/proc/$panel_pid/status"
}

cpu_ticks() {
	awk '{ print $14 + $15 }' "/proc/$panel_pid/stat"
}

# ---------------------------------------------------------------- scenarios

scenario_headers() {
	echo "# headers, nonce and session cookie"
	fresh
	local csp1 csp2 nonce1 nonce2 html
	fetch /login
	assert_eq "GET /login" "$status" 200
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
	assert_contains "permissions-policy denies the camera" "$(header permissions-policy)" "camera=()"
	assert_eq "x-powered-by is absent" "$(header x-powered-by)" ""
	fetch /login
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
	for path in / /accounts /domains /queue; do
		fetch "$path" "$cookie"
		assert_eq "GET $path with a session" "$status" 200
		nonce1=$(nonce_of_csp "$(header content-security-policy)")
		assert_contains "$path: nonce on its scripts" "$(cat "$work/b")" "nonce=\"$nonce1\""
		assert_eq "$path: no script tag without the nonce" "$(unnonced_scripts "$work/b" "$nonce1")" 0
		assert_eq "$path: no inline style attribute or element" \
			"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
		assert_absent "$path: not the unreachable alert" "$(cat "$work/b")" 'role="alert"'
	done

	fetch /does-not-exist "$cookie"
	assert_eq "unknown path with a session" "$status" 404
	assert_eq "404 page: no inline style attribute or element" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
}

scenario_logout() {
	echo "# logout revokes the token across proxy, pages and actions"
	fresh
	login admin correct-horse
	local old=$cookie
	login ops other-battery
	local other=$cookie
	fetch /queue "$old"
	assert_eq "GET /queue before logout" "$status" 200
	remove_args "$old"
	local field
	field=$(logout_field "$old")
	[[ -n "$field" ]] || not_ok "found the logout form field"

	local before after
	before=$(api_count '"path":"/api/v1/queue')
	curl -s -o /dev/null -D "$work/h" -b "$old" "$panel/" -F "$field="
	assert_contains "logout redirects to /login" "$(header location)" "/login"
	assert_contains "logout expires the cookie" "$(grep -i '^set-cookie' "$work/h" | tr -d '\r')" "Max-Age=0"

	fetch /queue "$old"
	assert_eq "replayed cookie on /queue" "$status" 307
	assert_contains "replayed cookie goes to /login" "$(header location)" "/login"
	curl -s -o /dev/null -D "$work/h" -b "$old" "$panel/queue" "${REMOVE_ARGS[@]}"
	assert_eq "replayed cookie on a Server Action" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	after=$(api_count '"path":"/api/v1/queue')
	assert_eq "the revoked token reached no queue endpoint" "$after" "$before"

	fetch /queue "$other"
	assert_eq "another session survives the logout" "$status" 200
}

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

scenario_noauth() {
	echo "# no session: every route and Server Action is denied before the API"
	fresh
	login admin correct-horse
	local good=$cookie
	remove_args "$good"
	local logout_field_name
	logout_field_name=$(logout_field "$good")
	local tampered="${good%?}"
	if [[ "${good: -1}" == "A" ]]; then tampered+="B"; else tampered+="A"; fi
	reset_api

	local path
	for path in / /accounts /domains /queue "/queue?cursor=11111111-1111-4111-8111-111111111111" /nope /login/../queue; do
		fetch "$path"
		assert_eq "no cookie: GET $path" "$status" 307
		assert_contains "no cookie: $path goes to /login" "$(header location)" "/login"
	done
	fetch /queue "$SESSION_COOKIE_NAME=garbage"
	assert_eq "garbage cookie" "$status" 307
	fetch /queue "$tampered"
	assert_eq "cookie with a changed signature" "$status" 307
	fetch /queue "$SESSION_COOKIE_NAME="
	assert_eq "empty cookie" "$status" 307

	curl -s -o /dev/null -D "$work/h" "$panel/queue" "${REMOVE_ARGS[@]}"
	assert_eq "no cookie: remove-entry form post" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	curl -s -o /dev/null -D "$work/h" -X POST -H "Next-Action: $REMOVE_ACTION_ID" \
		-H 'Content-Type: text/plain;charset=UTF-8' -d "[null,\"$REMOVE_ID\"]" "$panel/queue"
	assert_eq "no cookie: remove-entry fetch with Next-Action" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	curl -s -o /dev/null -D "$work/h" -b "$tampered" "$panel/queue" "${REMOVE_ARGS[@]}"
	assert_eq "tampered cookie: remove-entry form post" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	curl -s -o /dev/null -D "$work/h" "$panel/" -F "$logout_field_name="
	assert_eq "no cookie: logout action" "$(head -1 "$work/h" | cut -d' ' -f2)" 307
	assert_eq "none of it reached the stand-in" "$(api_count '"method"')" 0

	curl -s -o /dev/null -D "$work/h" -b "$good" "$panel/queue" "${REMOVE_ARGS[@]}"
	assert_eq "with the session the same post is accepted" "$(api_count '"method":"DELETE"')" 1
	fetch /queue "$good"
	assert_absent "the removed entry is gone from the page" "$(cat "$work/b")" "$REMOVE_ID"
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}

scenario_degraded() {
	echo "# API that hangs or streams a huge body"
	fresh
	login admin correct-horse
	local good=$cookie
	set_mode hang
	( fetch_hang=$(curl -s -o "$work/hang.body" -w '%{http_code} %{time_total}' -b "$good" "$panel/domains"); echo "$fetch_hang" >"$work/hang.result" ) &
	local hang_job=$!
	sleep 1.5
	fetch /login
	assert_between "the server answers while a call hangs" "$elapsed" 0 0.5
	wait "$hang_job"
	read -r status elapsed <"$work/hang.result"
	assert_eq "hanging API: the page still renders" "$status" 200
	assert_between "hanging API: degraded within the 10 s budget" "$elapsed" 9.5 12
	assert_contains "hanging API: the unreachable alert" "$(cat "$work/hang.body")" 'role="alert"'

	set_mode huge
	local before_rss after_rss
	before_rss=$(rss_kib)
	fetch /domains "$good"
	assert_eq "huge body: the page still renders" "$status" 200
	assert_between "huge body: degraded well inside the budget" "$elapsed" 0 5
	assert_contains "huge body: the unreachable alert" "$(cat "$work/b")" 'role="alert"'
	after_rss=$(rss_kib)
	echo "# rss before/after the huge body: ${before_rss} KiB / ${after_rss} KiB"
	if ((after_rss - before_rss < 150 * 1024)); then
		ok "huge body: memory stays bounded"
	else
		not_ok "huge body: memory stays bounded" "grew $((after_rss - before_rss)) KiB"
	fi

	set_mode ok
	fetch /domains "$good"
	assert_contains "the API back: the page recovers" "$(cat "$work/b")" "example.test"
}

scenario_rotation() {
	echo "# _FILE secret rotation"
	fresh
	login admin correct-horse
	local old=$cookie
	# No request carries the cookie before the rotation: the proxy reads the
	# secret file on its first one, and that read must find the same value the
	# sign-in action signed with.
	local new_secret="rotated-session-secret-$RANDOM$RANDOM$RANDOM"
	write_secret "$new_secret" "$session_secret_file"
	write_secret "rotated-token-$RANDOM$RANDOM" "$api_token_file"
	fetch /queue "$old"
	assert_eq "no restart: the old session still verifies (read once per process)" "$status" 200
	assert_absent "no restart: the old token is still the one sent" "$(cat "$work/b")" 'role="alert"'
	login ops other-battery
	assert_eq "no restart: a new sign-in works (every bundle holds the same secret)" "$status" 303
	fetch /queue "$cookie"
	assert_eq "no restart: the new session verifies" "$status" 200

	# The restart picks up both files; the stand-in learns the new token too.
	start_stand_in
	start_panel
	fetch /queue "$old"
	assert_eq "after restart: the session signed with the old secret is refused" "$status" 307
	login ops other-battery
	assert_eq "after restart: signing in works with the new files" "$status" 303
	fetch /queue "$cookie"
	assert_eq "after restart: the new session verifies" "$status" 200
	assert_absent "after restart: the new token is accepted by the API" "$(cat "$work/b")" 'role="alert"'
	assert_eq "no secret ever reached the server log" \
		"$({ grep -c -F -e "$new_secret" -e correct-horse -e other-battery "$work/panel.log" || true; })" 0
}

scenario_idle() {
	echo "# memory and CPU, idle and after 200 requests"
	fresh
	login admin correct-horse
	local good=$cookie
	fetch /queue "$good"
	local rss0 ticks0 ticks1 rss1 rss2 i
	sleep 1
	rss0=$(rss_kib)
	ticks0=$(cpu_ticks)
	sleep 3
	ticks1=$(cpu_ticks)
	echo "# idle: rss ${rss0} KiB, $((ticks1 - ticks0)) CPU ticks in 3 s (100 ticks = 1 s)"
	((ticks1 - ticks0 <= 30)) && ok "idle CPU stays under 10 percent" || not_ok "idle CPU stays under 10 percent"
	for i in $(seq 1 50); do
		curl -s -o /dev/null -b "$good" "$panel/"
		curl -s -o /dev/null -b "$good" "$panel/queue"
		curl -s -o /dev/null -b "$good" "$panel/domains"
		curl -s -o /dev/null "$panel/login"
	done
	sleep 1
	rss1=$(rss_kib)
	echo "# after 200 requests: rss ${rss1} KiB (+$((rss1 - rss0)) KiB)"
	if ((rss1 - rss0 < 100 * 1024)); then
		ok "memory after 200 requests stays within 100 MiB of idle"
	else
		not_ok "memory after 200 requests stays within 100 MiB of idle"
	fi
	rss2=$(rss_kib)
	if ((rss2 > 0)); then ok "server still alive"; else not_ok "server still alive"; fi
}

# ---------------------------------------------------------------- main

all=(headers logout limiter limiter-global noauth degraded rotation idle)
selected=("$@")
((${#selected[@]})) || selected=("${all[@]}")

for name in "${selected[@]}"; do
	case "$name" in
	headers) scenario_headers ;;
	logout) scenario_logout ;;
	limiter) scenario_limiter ;;
	limiter-global) scenario_limiter_global ;;
	noauth) scenario_noauth ;;
	degraded) scenario_degraded ;;
	rotation) scenario_rotation ;;
	idle) scenario_idle ;;
	*)
		echo "error: unknown scenario '$name'" >&2
		exit 2
		;;
	esac
done

echo
echo "$passed passed, $failed failed"
((failed == 0))
