# shellcheck shell=bash disable=SC2154,SC2034
# Audit regression checks; sourced by run.sh. HTTP only, no browser.
audit_body_spellings() {
 local good=$1 path
 # Audit 9: raw --path-as-is retains encoded dot segments on the wire.
 # All these spellings lack a valid UUID: only exact body paths reach its 404.
 for path in /app/mail/body/x /app/mail/body/a%2Fb; do
  reset_log
  status=$(curl -s --path-as-is -D "$work/h" -o "$work/b" -w '%{http_code}' -b "$good" "$panel$path")
  assert_eq "row 9: $path is refused as an invalid body id" "$status" 404
  assert_eq "row 9: $path keeps the body's framing header" "$(header x-frame-options)" SAMEORIGIN
  assert_eq "row 9: $path keeps the body's referrer policy" "$(header referrer-policy)" no-referrer
  assert_contains "row 9: $path keeps the body's sandbox CSP" "$(header content-security-policy)" "default-src 'none'"
  assert_eq "row 9: malformed body id never reaches JMAP" "$(api_count '"method"')" 0
 done
 # %2e%2e never reaches the route: Next normalizes the encoded dot segment and
 # answers 308 to the parent (/app/mail), with no body-route headers and no
 # body. Pin that redirect and that it never touches the API.
 reset_log
 fetch /app/mail/body/%2e%2e "$good"
 assert_eq "row 9: encoded dot segment is normalized by redirect" "$status" 308
 assert_eq "row 9: encoded dot segment redirect target" "$(header location)" /app/mail
 assert_eq "row 9: encoded dot segment never reaches JMAP" "$(api_count '"method"')" 0
 for path in /app/mail/body/x/y /APP/MAIL/body/x; do
  fetch "$path" "$good"
  assert_eq "row 9: $path gets panel framing policy" "$(header x-frame-options)" DENY
  assert_eq "row 9: $path gets panel referrer policy" "$(header referrer-policy)" same-origin
 done
 reset_log
 fetch /app/mail/body/ "$good"
 assert_eq "row 9: trailing slash is canonicalized" "$status" 308
 assert_eq "row 9: slash redirect target" "$(header location)" /app/mail/body
 # The 308 is issued by Next before the panel's headers run and has only a
 # Location and a tiny text body, so it carries no framing header; harmless.
 assert_eq "row 9: slash redirect never reaches JMAP" "$(api_count '"method"')" 0
}
