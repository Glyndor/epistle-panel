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
# A fresh admin id for this run, as an installation has its own.
admin_id=$(cat /proc/sys/kernel/random/uuid)
adm="/app/$admin_id"

# shellcheck source=scripts/e2e/session-cookie.sh
. "$root/scripts/e2e/session-cookie.sh"
# shellcheck source=scripts/e2e/html-checks.sh
. "$root/scripts/e2e/html-checks.sh"

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
	EPISTLE_PANEL_SESSION_SECRET="$secret" EPISTLE_PANEL_ADMIN_ID="$admin_id" \
		PORT="$port" HOSTNAME=127.0.0.1 exec node server.js
) >"$work/server.log" 2>&1 &
pid=$!

tries=0
until curl -fs -o /dev/null "$base/"; do
	tries=$((tries + 1))
	if [ "$tries" -gt 50 ]; then
		echo "error: the server did not come up" >&2
		cat "$work/server.log" >&2
		exit 1
	fi
	sleep 0.2
done

cookie=$(cd "$internal" && EPISTLE_PANEL_SESSION_SECRET="$secret" bun --conditions react-server -e \
	'import { createSession } from "./src/lib/auth/session"; console.log(await createSession("admin", "admin"))')

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
	expect_header referrer-policy same-origin "$label"
	expect_header x-robots-tag "noindex, nofollow, noarchive, nosnippet, noimageindex" "$label"
	[ -n "$(header permissions-policy)" ] || fail "$label: no Permissions-Policy"
	[ -z "$(header x-powered-by)" ] || fail "$label: X-Powered-By is present"
	case "$(header content-security-policy)" in
	*"frame-ancestors 'none'"*) ;;
	"") [ "$label" = "static asset" ] || [ "$label" = "robots.txt" ] || fail "$label: no Content-Security-Policy" ;;
	*) fail "$label: CSP lacks frame-ancestors 'none'" ;;
	esac
	# Each header must appear once: a duplicate means two layers set it.
	for name in x-frame-options x-content-type-options referrer-policy x-robots-tag; do
		count=$(grep -ci "^$name:" "$work/h" || true)
		[ "$count" = 1 ] || fail "$label: $name appears $count times"
	done
}

# The page the session reaches, with a nonce on every script and none of the
# inline styles the CSP would block. It must be the page itself: a request the
# proxy redirects carries the same headers and an empty body, and would pass
# every check below without rendering anything.
fetch -H "Cookie: $SESSION_COOKIE_NAME=$cookie" "$base$adm/queue"
status=$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")
[ "$status" = 200 ] || fail "authenticated page: status $status, want 200 (is the session cookie name right?)"
grep -q '<html' "$work/b" || fail "authenticated page: the body is not an HTML document"
grep -q '</html>' "$work/b" || fail "authenticated page: the HTML document is cut short"
expect_secure_headers "authenticated page"
nonce=$(header content-security-policy | sed -n "s/.*'nonce-\([^']*\)'.*/\1/p")
[ -n "$nonce" ] || fail "authenticated page: no nonce in the CSP"
case "$(header content-security-policy)" in
	*"style-src 'self'; style-src-elem 'self' 'nonce-$nonce'"*) ;;
	*) fail "authenticated page: style-src-elem is not self plus the request's nonce" ;;
esac
bare=$(unnonced_scripts "$work/b" "$nonce")
[ "$bare" = 0 ] || fail "authenticated page: $bare script tags lack the nonce"
grep -q ' style="\|<style' "$work/b" && fail "authenticated page: inline style, blocked by style-src"

# The sign-in page, at the root, is public but carries the same headers and a nonce.
fetch "$base/"
expect_secure_headers "login page"
grep -q "nonce-" "$work/h" || fail "login page: no nonce"

# Two requests must not share a nonce.
first=$(header content-security-policy)
fetch "$base/"
[ "$first" != "$(header content-security-policy)" ] || fail "the nonce repeats between requests"

# Redirects keep the headers, and a client-chosen host never reaches Location.
# The only redirect left is the mail area without a session.
for extra in "X-Forwarded-Host: evil.test" "Host: evil.test" "X-Forwarded-Proto: gopher"; do
	fetch -H "$extra" "$base/app/mail"
	[ "$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")" = 307 ] || fail "no 307 for '$extra'"
	expect_header location / "redirect with '$extra'"
	expect_secure_headers "redirect with '$extra'"
done

# The admin area without a session is the 404 of a missing path with the same
# headers, never a redirect, and so is a Server Action POST to it.
fetch "$base$adm/queue"
[ "$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")" = 404 ] || fail "admin area without a session: not a 404"
[ -z "$(header location)" ] || fail "admin area without a session: a Location header"
expect_secure_headers "admin area without a session"
# Next answers a Server Action posted to a path no route has in its own way, so
# the hidden one must answer the same, not a redirect.
fetch -X POST -H "Next-Action: 00" -H "Content-Type: text/plain" -d "[]" "$base/no-such-route"
missing=$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")
fetch -X POST -H "Next-Action: 00" -H "Content-Type: text/plain" -d "[]" "$base$adm/queue"
[ "$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")" = "$missing" ] || fail "server action without session: not what a missing path answers ($missing)"
[ -z "$(header location)" ] || fail "server action without session: a Location header"
expect_secure_headers "server action without session"

# robots.txt answers without a session, refuses everything, and opens nothing
# else: a look-alike path is not robots.txt, and one under /app is still
# the 404.
fetch "$base/robots.txt"
status=$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")
[ "$status" = 200 ] || fail "robots.txt without a session: status $status, want 200"
expect_secure_headers "robots.txt"
grep -qx 'Disallow: /' "$work/b" || fail "robots.txt does not say 'Disallow: /'"
! grep -qi '^allow:\|^sitemap:' "$work/b" || fail "robots.txt allows a path or names a sitemap"
for path in /robots.txtx /robots.txt/queue /x/robots.txt /ROBOTS.TXT; do
	fetch "$base$path"
	status=$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")
	[ "$status" = 404 ] || fail "$path without a session: status $status, want 404"
done
fetch "$base/app/queue"
status=$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")
[ "$status" = 404 ] || fail "/app/queue without a session: status $status, want 404"

# The page itself says it is not to be indexed.
fetch -H "Cookie: $SESSION_COOKIE_NAME=$cookie" "$base$adm/queue"
grep -q '<meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex"' "$work/b" ||
	fail "authenticated page: no robots meta tag"
for forbidden in 'rel="canonical"' 'property="og:' 'name="twitter:' 'name="description"'; do
	! grep -q "$forbidden" "$work/b" || fail "authenticated page carries $forbidden"
done
fetch "$base/sitemap.xml"
[ "$(sed -n '1s/^[^ ]* \([0-9]*\).*/\1/p' "$work/h")" = 404 ] || fail "sitemap.xml answers something other than a 404"

# Static assets skip the proxy but keep the static headers.
chunk=$(grep -o '/_next/static/[^"]*\.js' "$work/b" | head -n 1 || true)
[ -n "$chunk" ] || { fetch "$base/"; chunk=$(grep -o '/_next/static/[^"]*\.js' "$work/b" | head -n 1); }
fetch "$base$chunk"
expect_secure_headers "static asset"

# The admin id is in no public response: not in the sign-in page, robots.txt or
# a 404, nor in the headers of any of them.
for path in / /robots.txt /nothing-here "/app/$(cat /proc/sys/kernel/random/uuid)/queue"; do
	fetch "$base$path"
	! grep -q "$admin_id" "$work/b" "$work/h" || fail "$path carries the admin id"
done

echo "ok: security headers verified against $base"
