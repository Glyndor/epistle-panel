# shellcheck shell=bash disable=SC2154,SC2034
# Audit regression checks; sourced by run.sh. HTTP only, no browser.
audit_forwarded_origin() {
 local good=$1 path code
 # Audit 5: deployment must overwrite X-Forwarded-Host (README's proxy contract).
 for path in /app/mail/compose-message /app/mail/upload; do
  reset_log
  code=$(curl -s -X POST -D "$work/h" -o "$work/b" -w '%{http_code}' -b "$good" -H 'Origin: https://evil.test' -H 'Content-Type: application/json' --data-binary '{}' "$panel$path")
  assert_eq "row 5: foreign origin alone is refused at $path" "$code" 403
  assert_eq "row 5: foreign origin makes no API call" "$(api_count '"method"')" 0
  code=$(curl -s -X POST -D "$work/h" -o "$work/b" -w '%{http_code}' -b "$good" -H 'Origin: https://evil.test' -H 'X-Forwarded-Host: evil.test' -H 'Content-Type: application/json' --data-binary '{}' "$panel$path")
  if [[ "$path" == /app/mail/compose-message ]]; then
   assert_eq "row 5: matched forged host passes origin gate, then fails schema" "$code" 400
   assert_contains "row 5: schema refusal rather than forbidden" "$(cat "$work/b")" '"reason":"invalid"'
   assert_eq "row 5: invalid compose still cannot reach JMAP" "$(api_count '"method"')" 0
  else
   assert_eq "row 5: matched forged host permits upload under proxy trust contract" "$code" 200
   assert_contains "row 5: permitted upload reaches blob store" "$(api_log)" /jmap/upload/
  fi
 done
}
