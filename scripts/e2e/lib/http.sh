# shellcheck shell=bash disable=SC2154,SC2034
# HTTP helpers: fetch, login, form fields of the rendered pages, process counters.
# Sourced by scripts/e2e/run.sh, which defines the variables it reads.

# fetch PATH [COOKIE]: headers to $work/h, body to $work/b, status in $status,
# total time in $elapsed.
fetch() {
	local cookie=()
	[[ -n "${2:-}" ]] && cookie=(-b "$2")
	local out
	out=$(curl -s -D "$work/h" -o "$work/b" -w '%{http_code} %{time_total}' \
		"${cookie[@]}" "$panel$1")
	status=${out% *}
	elapsed=${out#* }
}

# header NAME: value of a response header of the last fetch, case-insensitive.
header() {
	{ grep -i "^$1:" "$work/h" || true; } | head -1 | cut -d: -f2- |
		sed 's/^ *//' | tr -d '\r'
}

# html_field HTML NAME: value of a hidden form field, unescaped.
html_field() {
	local name=${2//\$/\\\$}
	printf '%s' "$1" | { grep -o "name=\"$name\" value=\"[^\"]*\"" || true; } |
		head -1 | sed 's/^[^=]*="[^"]*" value="//; s/"$//; s/&quot;/"/g; s/&amp;/\&/g'
}

# post_login NAME PASSWORD HEADER_FILE BODY_FILE [FIELD]: posts the login form
# without JavaScript, with one more form field (name=value) when FIELD is given,
# and prints the status and the total time.
post_login() {
	local html a0 a1 key extra=()
	[[ -n "${5:-}" ]] && extra=(-F "$5")
	html=$(curl -s "$panel/login")
	a0=$(html_field "$html" '$ACTION_1:0')
	a1=$(html_field "$html" '$ACTION_1:1')
	key=$(html_field "$html" '$ACTION_KEY')
	curl -s -D "$3" -o "$4" -w '%{http_code} %{time_total}' "$panel/login" \
		-F '$ACTION_REF_1=' -F "\$ACTION_1:0=$a0" -F "\$ACTION_1:1=$a1" \
		-F "\$ACTION_KEY=$key" -F "name=$1" -F "password=$2" "${extra[@]}"
}

# login NAME PASSWORD [FIELD]: sets $status, $elapsed and $cookie (name=value, empty
# when the server set none).
login() {
	local out
	out=$(post_login "$1" "$2" "$work/h" "$work/b" "${3:-}")
	status=${out% *}
	elapsed=${out#* }
	cookie=$({ grep -i "^set-cookie: $SESSION_COOKIE_NAME=" "$work/h" || true; } |
		head -1 | sed 's/^[^:]*: //; s/;.*//' | tr -d '\r')
}

# logout_id COOKIE: name of the logout form field in the navigation.
logout_field() {
	curl -s -b "$1" "$panel/" |
		{ grep -o 'name="\$ACTION_ID_[0-9a-f]*"' || true; } | head -1 | sed 's/name="//; s/"$//'
}

# The queue entry the remove-entry checks target: the stand-in's first one.
REMOVE_ID="11111111-1111-4111-8111-111111111111"

# action_id FILE: id of the Server Action defined in the source file that ends
# with FILE, read from the build's reference manifest. A Server Action id is not
# in the HTML any more (the queue's Remove button is a client component), so the
# checks post to the action the way the browser's client does.
action_id() {
	node -e '
		const m = require(process.argv[1]).node;
		const hit = Object.entries(m).find(([, v]) => v.filename.endsWith(process.argv[2]));
		if (hit) process.stdout.write(hit[0]);
	' "$standalone/.next/server/server-reference-manifest.json" "$1"
}

# post_action FILE ARGS_JSON [COOKIE]: post the Server Action defined in the
# source file that ends with FILE, with ARGS_JSON as its arguments, the way the
# browser's client does. Body to $work/b, headers to $work/h, status printed.
post_action() {
	local cookie=()
	[[ -n "${3:-}" ]] && cookie=(-b "$3")
	curl -s -o "$work/b" -D "$work/h" -w '%{http_code}' -X POST \
		-H "Next-Action: $(action_id "$1")" \
		-H 'Content-Type: text/plain;charset=UTF-8' \
		"${cookie[@]}" -d "$2" "$panel/queue"
}

# post_remove [COOKIE]: post the remove-entry action for $REMOVE_ID, with the
# cookie when one is given, and print the HTTP status.
post_remove() {
	post_action features/queue/actions/remove-entry/index.ts "[{\"id\":\"$REMOVE_ID\"}]" "${1:-}"
}

nonce_of_csp() {
	printf '%s' "$1" | { grep -o "'nonce-[^']*'" || true; } | head -1 | sed "s/'nonce-//; s/'$//"
}

rss_kib() {
	awk '/^VmRSS:/ { print $2 }' "/proc/$panel_pid/status"
}

cpu_ticks() {
	awk '{ print $14 + $15 }' "/proc/$panel_pid/stat"
}
