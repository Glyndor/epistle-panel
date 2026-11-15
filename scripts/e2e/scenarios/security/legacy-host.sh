# shellcheck shell=bash disable=SC2154,SC2034
# Audit regression checks; sourced by run.sh. HTTP only, no browser.
audit_legacy_host() {
 local good=$1 code location
 # Audit 20: query-derived redirects must stay relative despite forged hosts.
 code=$(curl -s -D "$work/h" -o "$work/b" -w '%{http_code}' -b "$good" -H 'Host: evil.test' -H 'X-Forwarded-Host: evil.test' "$panel/app/mail?box=Sent&q=a%26page%3D9")
 location=$(header location)
 assert_eq "row 20: legacy request still redirects" "$code" 307
 assert_eq "row 20: host spoofing cannot change the relative encoded target" "$location" '/app/mail/folder/Sent?q=a%26page%3D9'
 assert_absent "row 20: forged host never reaches Location" "$location" evil.test
}
