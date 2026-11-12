#!/bin/sh
# Start the built standalone server and assert, over real HTTP, the security
# headers and the redirect behaviour the unit tests can only check in-process.
# Run `bun run build` in internal/ first. Needs node, curl and bun; talks only
# to 127.0.0.1. Exit status is non-zero on the first failed assertion.
set -eu

root=$(cd "$(dirname "$0")/../.." && pwd)
internal="$root/internal"
standalone="$internal/.next/standalone"
port="${PORT:-7598}"
base="http://127.0.0.1:$port"
secret="verify-headers-secret-verify-headers-secret"

if [ ! -f "$standalone/server.js" ]; then
	echo "error: $standalone/server.js is missing, run 'bun run build' in internal/ first" >&2
	exit 1
fi

work=$(mktemp -d)
pid=""
cleanup() {
	if [ -n "$pid" ]; then
		kill "$pid" 2>/dev/null || true
	fi
	rm -rf "$work"
}
trap cleanup EXIT INT TERM

# `next build` leaves the static assets out of the standalone folder; the
# container image copies them in the same way.
mkdir -p "$standalone/.next"
rm -rf "$standalone/.next/static"
cp -R "$internal/.next/static" "$standalone/.next/static"

(
	cd "$standalone"
	EPISTLE_PANEL_SESSION_SECRET="$secret" PORT="$port" HOSTNAME=127.0.0.1 \
		exec node server.js
) >"$work/server.log" 2>&1 &
pid=$!

tries=0
until curl -fs -o /dev/null "$base/login"; do
	tries=$((tries + 1))
	if [ "$tries" -gt 50 ]; then
		echo "error: the server did not come up" >&2
		cat "$work/server.log" >&2
		exit 1
	fi
	sleep 0.2
done

cookie=$(cd "$internal" && EPISTLE_PANEL_SESSION_SECRET="$secret" bun -e \
	'import { createSession } from "./src/lib/auth/session"; console.log(await createSession("admin"))')

fail() {
	echo "FAIL: $*" >&2
	exit 1
}

# Fetch one URL, keeping headers in $work/h and the body in $work/b. Extra
# arguments are passed to curl.
fetch() {
	curl -s -D "$work/h" -o "$work/b" "$@"
}

header() {
	sed -n "s/^$1: *//Ip" "$work/h" | tr -d '\r'
}

expect_header() {
	value=$(header "$1")
	[ "$value" = "$2" ] || fail "$3: header $1 is '$value', want '$2'"
}

expect_secure_headers() {
	label=$1
	expect_header x-frame-options DENY "$label"
	expect_header x-content-type-options nosniff "$label"
	expect_header referrer-policy no-referrer "$label"
	[ -n "$(header permissions-policy)" ] || fail "$label: no Permissions-Policy"
	[ -z "$(header x-powered-by)" ] || fail "$label: X-Powered-By is present"
	case "$(header content-security-policy)" in
	*"frame-ancestors 'none'"*) ;;
	"") [ "$label" = "static asset" ] || fail "$label: no Content-Security-Policy" ;;
	*) fail "$label: CSP lacks frame-ancestors 'none'" ;;
	esac
	# Each header must appear once: a duplicate means two layers set it.
	for name in x-frame-options x-content-type-options referrer-policy; do
		count=$(grep -ci "^$name:" "$work/h" || true)
		[ "$count" = 1 ] || fail "$label: $name appears $count times"
	done
}

# The page the session reaches, with a nonce on every inline script and none
# of the inline styles the CSP would block.
fetch -H "Cookie: epistle_admin_session=$cookie" "$base/queue"
expect_secure_headers "authenticated page"
nonce=$(header content-security-policy | sed -n "s/.*'nonce-\([^']*\)'.*/\1/p")
[ -n "$nonce" ] || fail "authenticated page: no nonce in the CSP"
bare=$(grep -o '<script[^>]*>' "$work/b" | grep -vc "nonce=\"$nonce\"" || true)
[ "$bare" = 0 ] || fail "authenticated page: $bare script tags lack the nonce"
grep -q ' style="\|<style' "$work/b" && fail "authenticated page: inline style, blocked by style-src"

# The login page is public but carries the same headers and a nonce.
fetch "$base/login"
expect_secure_headers "login page"
grep -q "nonce-" "$work/h" || fail "login page: no nonce"

# Two requests must not share a nonce.
first=$(header content-security-policy)
fetch "$base/login"
[ "$first" != "$(header content-security-policy)" ] || fail "the nonce repeats between requests"

# Redirects keep the headers, and a client-chosen host never reaches Location.
for extra in "X-Forwarded-Host: evil.test" "Host: evil.test" "X-Forwarded-Proto: gopher"; do
	fetch -H "$extra" "$base/queue"
	[ "$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")" = 307 ] || fail "no 307 for '$extra'"
	expect_header location /login "redirect with '$extra'"
	expect_secure_headers "redirect with '$extra'"
done

# A Server Action POST without a session is redirected, headers included.
fetch -X POST -H "Next-Action: 00" -H "Content-Type: text/plain" -d "[]" "$base/queue"
expect_secure_headers "server action without session"

# Static assets skip the proxy but keep the static headers.
chunk=$(grep -o '/_next/static/[^"]*\.js' "$work/b" | head -n 1 || true)
[ -n "$chunk" ] || { fetch "$base/login"; chunk=$(grep -o '/_next/static/[^"]*\.js' "$work/b" | head -n 1); }
fetch "$base$chunk"
expect_secure_headers "static asset"

echo "ok: security headers verified against $base"
