# shellcheck shell=bash disable=SC2154,SC2034
# Scenario unknown-variable of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

scenario_unknown_variable() {
	echo "# startup warning for an EPISTLE_PANEL_ variable the panel does not read"
	fresh
	assert_absent "a clean start logs no unknown-variable warning" "$(cat "$work/panel.log")" "unknown configuration variable"

	panel_env=(EPISTLE_PANEL_LOGIN_MIN_MSS=hunter2-value EPISTLE_PANEL_BRAND_NAME=Known)
	start_panel
	local log
	log=$(cat "$work/panel.log")
	assert_contains "a misspelt name is warned about" "$log" "unknown configuration variable EPISTLE_PANEL_LOGIN_MIN_MSS"
	assert_absent "the warning never prints the value" "$log" "hunter2-value"
	assert_absent "a name the panel reads is not warned about" "$log" "unknown configuration variable EPISTLE_PANEL_BRAND_NAME"
	assert_absent "the secret _FILE form is not warned about" "$log" "EPISTLE_PANEL_SESSION_SECRET_FILE"
	fetch /
	assert_eq "the panel still serves with the unknown name set" "$status" 200
	panel_env=()
}
