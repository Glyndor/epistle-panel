# shellcheck shell=bash disable=SC2154,SC2034
# Audit regression checks; sourced by run.sh. HTTP only, no browser.
audit_upload_methods() {
 local method code
 # Audit 7, REAL DEFECT: framework's automatic method responses lack route CSP.
 for method in GET OPTIONS; do
  reset_log
  code=$(curl -s -X "$method" -D "$work/h" -o "$work/b" -w '%{http_code}' "$panel/app/mail/upload")
  if [[ "$method" == GET ]]; then
   assert_eq "row 7: GET upload is a method refusal without a session" "$code" 405
  else
   assert_eq "row 7: OPTIONS upload is automatic" "$code" 204
   assert_contains "row 7: Allow declares POST" "$(header allow)" POST
  fi
  assert_eq "row 7 REAL DEFECT: automatic response has no CSP" "$(header content-security-policy)" ""
  assert_eq "row 7: no session renewal" "$(header set-cookie)" ""
  assert_eq "row 7: no API call" "$(api_count '"method"')" 0
 done
}
