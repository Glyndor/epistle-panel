# shellcheck shell=bash disable=SC2154,SC2034
# Audit regression checks; sourced by run.sh. HTTP only, no browser.
scenario_security() {
 echo "# audit security regressions (rows 3 and 15 intentionally excluded)"
 panel_env=(EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES=10)
 fresh
 login admin correct-horse
 local good=$cookie
 assert_eq "security baseline login" "$status" 303
 audit_cookie_parsing "$good"
 audit_forwarded_origin "$good"
 audit_upload_methods
 audit_body_spellings "$good"
 audit_legacy_host "$good"
 audit_unsupported_methods "$good"
 panel_env=()
}
