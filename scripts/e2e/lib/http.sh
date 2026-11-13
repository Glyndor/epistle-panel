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
# and prints the status and the total time. Extra curl arguments in the array
# login_extra, such as -F captcha=TOKEN, are sent with it.
post_login() {
	local html a0 a1 key extra=()
	[[ -n "${5:-}" ]] && extra=(-F "$5")
	html=$(curl -s "$panel/")
	a0=$(html_field "$html" '$ACTION_1:0')
	a1=$(html_field "$html" '$ACTION_1:1')
	key=$(html_field "$html" '$ACTION_KEY')
	curl -s -D "$3" -o "$4" -w '%{http_code} %{time_total}' "$panel/" \
		-F '$ACTION_REF_1=' -F "\$ACTION_1:0=$a0" -F "\$ACTION_1:1=$a1" \
		-F "\$ACTION_KEY=$key" -F "name=$1" -F "password=$2" "${extra[@]}" \
		${login_extra[@]+"${login_extra[@]}"}
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
	curl -s -b "$1" "$panel$adm" |
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
# Extra request headers ("Name: value") go in the array action_headers, and
# action_page (default $adm/queue) is the page the post is addressed to.
post_action() {
	local cookie=()
	[[ -n "${3:-}" ]] && cookie=(-b "$3")
	curl -s -o "$work/b" -D "$work/h" -w '%{http_code}' -X POST \
		-H "Next-Action: $(action_id "$1")" \
		-H 'Content-Type: text/plain;charset=UTF-8' \
		${action_headers[@]+"${action_headers[@]/#/-H}"} \
		"${cookie[@]}" -d "$2" "$panel${action_page:-$adm/queue}"
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

# The body $1 with the per-request nonce, which the CSP header in $2 names,
# blanked wherever it appears (attributes and the escaped copies in the page's
# own payload): the one thing two responses to different requests may differ in.
normalize_body() {
	local nonce
	nonce=$(nonce_of_csp "$(grep -i '^content-security-policy:' "$2" | head -1)")
	NONCE="$nonce" perl -pe 'BEGIN { $n = $ENV{NONCE} } s/\Q$n\E/NONCE/g if length $n' "$1"
}

# The headers of $1 sorted, without the date and with the nonce of the CSP
# blanked. Two responses that no outside observer may tell apart are equal here.
normalize_headers() {
	tr -d '\r' <"$1" | grep -v -i '^date:' | sed -E "s/'nonce-[^']*'/'nonce'/g" | sort
}

# set_404_reference: fetch a path no route has and keep its status, headers and
# body as the reference every hidden response is compared with.
set_404_reference() {
	fetch "/no-such-route-$RANDOM$RANDOM"
	ref_status=$status
	normalize_body "$work/b" "$work/h" >"$work/ref.b"
	normalize_headers "$work/h" >"$work/ref.h"
	# A Server Action posted to a path no route has, no session: what a hidden
	# action must look like. Next answers it differently from a GET.
	local saved=${action_page:-}
	action_page="/no-such-route-$RANDOM$RANDOM"
	ref_action_status=$(post_action features/queue/actions/remove-entry/index.ts "[{\"id\":\"$REMOVE_ID\"}]")
	action_page=$saved
	normalize_body "$work/b" "$work/h" >"$work/ref-action.b"
	normalize_headers "$work/h" >"$work/ref-action.h"
}

# assert_hidden DESCRIPTION PATH [COOKIE]: a GET that must be indistinguishable
# from a path no route has: a 404 with the same headers and the same body, nonce
# aside, and not a redirect.
assert_hidden() {
	fetch "$2" "${3:-}"
	compare_with_reference "$1" "$status"
}

# compare_with_reference DESCRIPTION STATUS: the last response, headers in $work/h
# and body in $work/b, against the reference of set_404_reference.
compare_with_reference() {
	assert_eq "$1: status is the 404 of a missing path" "$2" "$ref_status"
	if [[ "$(normalize_body "$work/b" "$work/h")" == "$(cat "$work/ref.b")" ]]; then
		ok "$1: body equals the body of a missing path"
	else
		not_ok "$1: body equals the body of a missing path" "the bodies differ"
	fi
	if [[ "$(normalize_headers "$work/h")" == "$(cat "$work/ref.h")" ]]; then
		ok "$1: headers equal those of a missing path"
	else
		not_ok "$1: headers equal those of a missing path" "$(diff <(normalize_headers "$work/h") "$work/ref.h" | head -5)"
	fi
}

# assert_action_hidden DESCRIPTION FILE ARGS_JSON PAGE [COOKIE]: a Server Action
# post to PAGE that must be what the same post to a path no route has gets.
assert_action_hidden() {
	local code
	action_page=$4
	code=$(post_action "$2" "$3" "${5:-}")
	action_page=
	compare_action_with_reference "$1" "$code"
}

# compare_action_with_reference DESCRIPTION STATUS: the last response against the
# reference of a Server Action posted to a missing path.
compare_action_with_reference() {
	assert_eq "$1: status is that of a missing path" "$2" "$ref_action_status"
	if [[ "$(normalize_body "$work/b" "$work/h")" == "$(cat "$work/ref-action.b")" ]]; then
		ok "$1: body equals the body of a missing path"
	else
		not_ok "$1: body equals the body of a missing path" "the bodies differ"
	fi
	if [[ "$(normalize_headers "$work/h")" == "$(cat "$work/ref-action.h")" ]]; then
		ok "$1: headers equal those of a missing path"
	else
		not_ok "$1: headers equal those of a missing path" "$(diff <(normalize_headers "$work/h") "$work/ref-action.h" | head -5)"
	fi
}

# assert_no_id TEXT NAME: the admin id appears nowhere in TEXT.
assert_no_id() {
	assert_absent "$2 does not contain the admin id" "$1" "$admin_id"
}
