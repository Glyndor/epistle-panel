# shellcheck shell=bash disable=SC2154,SC2034
# Audit regression checks; sourced by run.sh. HTTP only, no browser.
audit_cookie_parsing() {
 local good=$1 code raw
 # Audit 1: pin last-wins parsing; a forged value alone never authenticates.
 for raw in "$good; $SESSION_COOKIE_NAME=FORGED" "$SESSION_COOKIE_NAME=FORGED"; do
  code=$(curl -s -D "$work/h" -o "$work/b" -w '%{http_code}' -H "Cookie: $raw" "$panel/app/mail/inbox")
  assert_eq "row 1: forged final cookie cannot authenticate" "$code" 307
  assert_eq "row 1: forged cookie redirects to sign in" "$(header location)" /
 done
 code=$(curl -s -o "$work/b" -w '%{http_code}' -H "Cookie: $SESSION_COOKIE_NAME=FORGED; $good" "$panel/app/mail/inbox")
 assert_eq "row 1: current last-wins parsing uses the valid final cookie" "$code" 200
 # Audit 2: malformed escapes discard the entire cookie pair. Appending bytes
 # also invalidates the signature; the unit test verifies that independently.
 for raw in "$good%zz" "$good%"; do
  reset_log
  code=$(curl -s -D "$work/h" -o "$work/b" -w '%{http_code}' -H "Cookie: $raw" "$panel/app/mail/inbox")
  assert_eq "row 2: malformed escape currently makes the session anonymous" "$code" 307
  assert_eq "row 2: anonymous redirect is fixed" "$(header location)" /
  assert_eq "row 2: no backend call on discarded cookie" "$(api_count '"method"')" 0
 done
}
