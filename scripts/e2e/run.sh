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
# talks only to 127.0.0.1. The `End-to-end` workflow (.github/workflows/e2e.yml)
# runs it on pull requests and pushes to develop that touch the code it
# exercises.
#
# Usage: scripts/e2e/run.sh [scenario...]
#   scenarios: headers logout limiter limiter-global noauth degraded rotation idle theme body-limit captcha csrf set-locale unknown-variable suppression deliveries account-detail admin-id mail
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
# The admin id of this run: a fresh UUID v4, the way an installation has its own.
# Nothing in the repository spells one, so no check can pass on a copied value.
admin_id=$(cat /proc/sys/kernel/random/uuid)
adm="/app/$admin_id"
panel_admin_id=$admin_id
api="http://127.0.0.1:$stand_in_port"

work=$(mktemp -d)
chmod 700 "$work"
mkdir "$work/secrets"
api_token_file="$work/secrets/api-token"
session_secret_file="$work/secrets/session-secret"
panel_pid=""
stand_in_pid=""
panel_env=()
login_extra=()
action_headers=()
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

# shellcheck source=scripts/e2e/lib/reporting.sh
. "$root/scripts/e2e/lib/reporting.sh"
# shellcheck source=scripts/e2e/lib/processes.sh
. "$root/scripts/e2e/lib/processes.sh"
# shellcheck source=scripts/e2e/lib/http.sh
. "$root/scripts/e2e/lib/http.sh"
# shellcheck source=scripts/e2e/scenarios/headers.sh
. "$root/scripts/e2e/scenarios/headers.sh"
# shellcheck source=scripts/e2e/scenarios/logout.sh
. "$root/scripts/e2e/scenarios/logout.sh"
# shellcheck source=scripts/e2e/scenarios/limiter.sh
. "$root/scripts/e2e/scenarios/limiter.sh"
# shellcheck source=scripts/e2e/scenarios/limiter-global.sh
. "$root/scripts/e2e/scenarios/limiter-global.sh"
# shellcheck source=scripts/e2e/scenarios/noauth.sh
. "$root/scripts/e2e/scenarios/noauth.sh"
# shellcheck source=scripts/e2e/scenarios/degraded.sh
. "$root/scripts/e2e/scenarios/degraded.sh"
# shellcheck source=scripts/e2e/scenarios/rotation.sh
. "$root/scripts/e2e/scenarios/rotation.sh"
# shellcheck source=scripts/e2e/scenarios/idle.sh
. "$root/scripts/e2e/scenarios/idle.sh"
# shellcheck source=scripts/e2e/scenarios/captcha.sh
. "$root/scripts/e2e/scenarios/captcha.sh"
# shellcheck source=scripts/e2e/scenarios/theme.sh
. "$root/scripts/e2e/scenarios/theme.sh"
# shellcheck source=scripts/e2e/scenarios/body-limit.sh
. "$root/scripts/e2e/scenarios/body-limit.sh"
# shellcheck source=scripts/e2e/scenarios/csrf.sh
. "$root/scripts/e2e/scenarios/csrf.sh"
# shellcheck source=scripts/e2e/scenarios/set-locale.sh
. "$root/scripts/e2e/scenarios/set-locale.sh"
# shellcheck source=scripts/e2e/scenarios/unknown-variable.sh
. "$root/scripts/e2e/scenarios/unknown-variable.sh"
# shellcheck source=scripts/e2e/scenarios/suppression.sh
. "$root/scripts/e2e/scenarios/suppression.sh"
# shellcheck source=scripts/e2e/scenarios/deliveries.sh
. "$root/scripts/e2e/scenarios/deliveries.sh"

# shellcheck source=scripts/e2e/scenarios/mail.sh
. "$root/scripts/e2e/scenarios/mail.sh"

# shellcheck source=scripts/e2e/scenarios/account-detail.sh
. "$root/scripts/e2e/scenarios/account-detail.sh"
# shellcheck source=scripts/e2e/scenarios/admin-id.sh
. "$root/scripts/e2e/scenarios/admin-id.sh"

# ---------------------------------------------------------------- main

all=(headers logout limiter limiter-global noauth degraded rotation idle theme body-limit captcha csrf set-locale unknown-variable suppression deliveries account-detail admin-id mail)
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
	theme) scenario_theme ;;
	body-limit) scenario_body_limit ;;
	captcha) scenario_captcha ;;
	csrf) scenario_csrf ;;
	set-locale) scenario_set_locale ;;
	unknown-variable) scenario_unknown_variable ;;
	suppression) scenario_suppression ;;
	deliveries) scenario_deliveries ;;
	account-detail) scenario_account_detail ;;
	admin-id) scenario_admin_id ;;
	*)
		echo "error: unknown scenario '$name'" >&2
		exit 2
		;;
	esac
done

echo
echo "$passed passed, $failed failed"
((failed == 0))
