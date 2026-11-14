# shellcheck shell=bash disable=SC2154,SC2034,SC2016
# Scenario profile-menu of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# header_html: the banner of the last page, the header element and all in it.
header_html() {
	perl -0777 -ne 'print $1 if /(<header\b.*?<\/header>)/s' "$work/b"
}

# noscript_html: what the banner of the last page keeps for a browser without script.
noscript_html() {
	header_html | perl -0777 -ne 'print $1 if /<noscript>(.*?)<\/noscript>/s'
}

scenario_profile_menu() {
	echo "# profile menu: both headers name the account from the session, and only an admin is handed the way in"
	fresh
	login admin correct-horse
	local admin_cookie=$cookie
	login user plain-staple
	local user_cookie=$cookie
	local header fallback path

	# --- an admin session, in the admin area and in the webmail: the same button, the same fallback
	for path in "$adm/queue" /app/mail; do
		fetch "$path" "$admin_cookie"
		assert_eq "admin session, GET $path" "$status" 200
		header=$(header_html)
		fallback=$(noscript_html)
		assert_contains "$path: the profile button names the account of the session" "$header" '>Account: admin</span>'
		assert_contains "$path: with its initial" "$header" 'data-slot="avatar-fallback"'
		assert_contains "$path: and it is a menu button, closed in the served page" "$header" 'aria-haspopup="menu"'
		assert_absent "$path: no picture is loaded for it" "$header" '<img'
		assert_contains "$path: without script, the way into the administration is a plain link built with the id" "$fallback" "href=\"$adm\""
		assert_contains "$path: without script, sign out is a plain form" "$fallback" 'name="$ACTION_ID_'
		assert_absent "$path: the banner has no select and no language list of its own" "$header" '<select'
		assert_eq "$path: no inline style in the banner" "$(printf '%s' "$header" | { grep -o -E ' style="|<style' || true; } | wc -l | tr -d ' ')" 0
	done
	fetch "$adm/queue" "$admin_cookie"
	assert_absent "the sidebar no longer holds sign out or the language" "$(perl -0777 -ne 'print $1 if /(<aside\b.*?<\/aside>)/s' "$work/b")" 'ACTION_ID'

	# --- a session that is not an admin's: the same button, no way in, and the id nowhere
	fetch /app/mail "$user_cookie"
	assert_eq "user session, GET /app/mail" "$status" 200
	header=$(header_html)
	fallback=$(noscript_html)
	assert_contains "a user's profile button names that account" "$header" '>Account: user</span>'
	assert_contains "a user keeps sign out without script" "$fallback" 'name="$ACTION_ID_'
	assert_absent "a user is given no link to the administration" "$fallback" '<a '
	assert_absent "nor the word for it" "$header" 'Administration'
	assert_absent "the id is nowhere in a user's page" "$(cat "$work/b")" "$admin_id"

	# --- the plain form signs out: the cookie is expired and the session is gone
	local field
	field=$(printf '%s' "$fallback" | { grep -o 'name="\$ACTION_ID_[0-9a-f]*"' || true; } | head -1 | sed 's/name="//; s/"$//')
	[[ -n "$field" ]] || not_ok "found the sign-out form field in the fallback"
	curl -s -o /dev/null -D "$work/h" -b "$user_cookie" "$panel/app/mail" -F "$field="
	assert_eq "the fallback form signs out to the sign-in page" "$(header location)" "/"
	assert_contains "and expires the session cookie" "$(grep -i '^set-cookie' "$work/h" | tr -d '\r')" "Max-Age=0"
	fetch /app/mail "$user_cookie"
	assert_eq "the signed-out session no longer opens the mail area" "$status" 307
}
