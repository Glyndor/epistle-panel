# shellcheck shell=bash disable=SC2154,SC2034
# Start and stop of the stand-in API and the panel, and the stand-in's control calls.
# Sourced by scripts/e2e/run.sh, which defines the variables it reads.

write_secret() {
	rm -f "$2"
	printf '%s\n' "$1" >"$2"
	chmod 0400 "$2"
}

start_stand_in() {
	stop_pid "$stand_in_pid"
	STAND_IN_TOKEN="$(tr -d '\n' <"$api_token_file")" STAND_IN_PORT="$stand_in_port" \
		bun "$root/scripts/e2e/stand-in-api/index.ts" >"$work/stand-in.log" 2>&1 &
	stand_in_pid=$!
	wait_http "$api/__control/log"
}

start_panel() {
	stop_pid "$panel_pid"
	(
		cd "$standalone" || exit 1
		exec env -i PATH="$PATH" NODE_ENV=production PORT="$panel_port" \
			HOSTNAME=127.0.0.1 NEXT_TELEMETRY_DISABLED=1 \
			EPISTLE_API_URL="$api" \
			EPISTLE_API_TOKEN_FILE="$api_token_file" \
			EPISTLE_PANEL_SESSION_SECRET_FILE="$session_secret_file" \
			EPISTLE_PANEL_LOGIN_MIN_MS="${login_min_ms:-1000}" \
			${panel_admin_id:+EPISTLE_PANEL_ADMIN_ID="$panel_admin_id"} \
			${panel_env[@]+"${panel_env[@]}"} \
			node server.js
	) >"$work/panel.log" 2>&1 &
	panel_pid=$!
	wait_http "$panel/"
}

wait_http() {
	for _ in $(seq 1 100); do
		if curl -s -o /dev/null "$1"; then
			return
		fi
		sleep 0.1
	done
	echo "error: $1 did not come up" >&2
	exit 1
}

# Fresh secrets, a fresh stand-in and a fresh panel: every scenario starts clean.
fresh() {
	write_secret "stand-in-token-$RANDOM$RANDOM" "$api_token_file"
	write_secret "session-secret-$RANDOM$RANDOM$RANDOM$RANDOM" "$session_secret_file"
	start_stand_in
	start_panel
}

api_log() {
	curl -s "$api/__control/log"
}

# Number of stand-in requests whose logged text matches the fixed string $1.
api_count() {
	{ api_log | grep -o -F "$1" || true; } | wc -l | tr -d ' '
}

verify_calls() {
	api_count '"path":"/api/v1/auth/verify"'
}

set_mode() {
	curl -s -o /dev/null -X POST "$api/__control/mode" -d "{\"mode\":\"$1\"}"
}

# set_delay MS: every data answer of the stand-in waits MS milliseconds.
set_delay() {
	curl -s -o /dev/null -X POST "$api/__control/delay" -d "{\"ms\":$1}"
}

# set_oversize_blobs true|false: every attachment the stand-in sends is 27 MiB
# with no declared size, or the real ones again.
set_oversize_blobs() {
	curl -s -o /dev/null -X POST "$api/__control/blobs" -d "{\"oversize\":$1}"
}

reset_api() {
	curl -s -o /dev/null -X POST "$api/__control/reset"
}
