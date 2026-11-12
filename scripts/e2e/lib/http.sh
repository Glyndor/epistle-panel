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

# post_login NAME PASSWORD HEADER_FILE BODY_FILE: posts the login form without
# JavaScript and prints the status and the total time.
post_login() {
	local html a0 a1 key
	html=$(curl -s "$panel/login")
	a0=$(html_field "$html" '$ACTION_1:0')
	a1=$(html_field "$html" '$ACTION_1:1')
	key=$(html_field "$html" '$ACTION_KEY')
	curl -s -D "$3" -o "$4" -w '%{http_code} %{time_total}' "$panel/login" \
		-F '$ACTION_REF_1=' -F "\$ACTION_1:0=$a0" -F "\$ACTION_1:1=$a1" \
		-F "\$ACTION_KEY=$key" -F "name=$1" -F "password=$2"
}

# login NAME PASSWORD: sets $status, $elapsed and $cookie (name=value, empty
# when the server set none).
login() {
	local out
	out=$(post_login "$1" "$2" "$work/h" "$work/b")
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

# remove_args COOKIE: fills REMOVE_ARGS with the curl -F arguments that submit
# the first Remove form of the queue page, and REMOVE_ID with its entry id.
remove_args() {
	local form n
	form=$(curl -s -b "$1" "$panel/queue" | sed 's/<form/\n<form/g' |
		{ grep 'name="id" value=' || true; } | head -1)
	n=$(printf '%s' "$form" | { grep -o 'ACTION_REF_[0-9]*' || true; } | head -1 | sed 's/ACTION_REF_//')
	REMOVE_ID=$(html_field "$form" 'id')
	REMOVE_FIELD0="\$ACTION_$n:0"
	REMOVE_ARGS=(
		-F "\$ACTION_REF_$n="
		-F "\$ACTION_$n:0=$(html_field "$form" "\$ACTION_$n:0")"
		-F "\$ACTION_$n:1=$(html_field "$form" "\$ACTION_$n:1")"
		-F "\$ACTION_KEY=$(html_field "$form" '$ACTION_KEY')"
		-F "id=$REMOVE_ID"
	)
	REMOVE_ACTION_ID=$(printf '%s' "$form" | { grep -o 'id&quot;:&quot;[0-9a-f]*' || true; } |
		head -1 | sed 's/.*;//')
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
