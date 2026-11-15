# shellcheck shell=bash disable=SC2154,SC2034,SC2016
# Scenario me of scripts/e2e/run.sh: the person's own page, /app/me.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# me_list_of CONSTANT FILE: the values of a `NAME = [ "a", "b" ] as const` list in
# a source file, so this scenario never keeps its own copy of a list.
me_list_of() {
	node -e '
		const src = require("node:fs").readFileSync(process.argv[2], "utf8");
		const list = new RegExp(process.argv[1] + " = \\[([^\\]]*)\\]").exec(src)[1];
		process.stdout.write([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]).join(" "));
	' "$1" "$internal/$2"
}
me_locales_of() { me_list_of SUPPORTED_LOCALES src/i18n/locales/index.ts; }
me_themes_of() { me_list_of THEME_CHOICES src/features/theme/config/choices/index.ts; }
me_remote_images_of() { me_list_of REMOTE_IMAGE_MODES src/features/mail/config/remote-images/index.ts; }
me_densities_of() { me_list_of LIST_DENSITIES src/features/mail/config/list-density/index.ts; }
me_page_sizes_of() { me_list_of PAGE_SIZE_CHOICES src/features/mail/config/page-size/index.ts; }
me_refresh_paces_of() { me_list_of REFRESH_PACES src/features/refresh/config/pace/index.ts; }

# me_post COOKIE [NAME=VALUE...]: post the preferences form the way a browser
# with no script does: read the page, send its hidden fields back as multipart
# with the fields given (a field left out is not sent, one named twice is sent
# twice). Status in $status, headers in $work/h, the page that answers in $work/b.
# The page size and the refresh pace are sent as 50 and normal unless the call
# names them; naming one with a leading dash (-pageSize) leaves it out.
me_post() {
	local cookie_arg=() html n a0 a1 key fields=() pair args=() has_size=0 has_refresh=0
	[[ -n "$1" ]] && cookie_arg=(-b "$1")
	shift
	for pair in "$@"; do
		case "$pair" in
			pageSize=* | -pageSize) has_size=1 ;;
			refresh=* | -refresh) has_refresh=1 ;;
		esac
		[[ "$pair" == -* ]] || args+=("$pair")
	done
	[[ $has_size == 1 ]] || args+=(pageSize=50)
	[[ $has_refresh == 1 ]] || args+=(refresh=normal)
	set -- "${args[@]}"
	html=$(curl -s "${cookie_arg[@]}" "$panel/app/me")
	# React numbers the forms of a page as they render, and the header's sign-out
	# form takes 1 or 2 depending on which part streamed first: read the number.
	n=$(printf '%s' "$html" | { grep -o 'name="\$ACTION_REF_[0-9]*"' || true; } | head -1 | sed 's/[^0-9]//g')
	a0=$(html_field "$html" "\$ACTION_$n:0")
	a1=$(html_field "$html" "\$ACTION_$n:1")
	key=$(html_field "$html" '$ACTION_KEY')
	for pair in "$@"; do
		fields+=(--form-string "$pair")
	done
	status=$(curl -s -D "$work/h" -o "$work/b" -w '%{http_code}' "${cookie_arg[@]}" "$panel/app/me" \
		--form-string "\$ACTION_REF_$n=" --form-string "\$ACTION_$n:0=$a0" \
		--form-string "\$ACTION_$n:1=$a1" --form-string "\$ACTION_KEY=$key" \
		"${fields[@]}")
}

# prefs_set: the Set-Cookie headers of the last response that name a preference.
me_prefs_set() {
	{ grep -i -E '^set-cookie: (locale|theme|list-density|remote-images|time-zone|page-size|refresh)=' "$work/h" || true; } | tr -d '\r'
}

# prefs_set_count: how many of them there are.
me_prefs_set_count() {
	me_prefs_set | { grep -c . || true; }
}

# me_selected NAME: the value of the option of the select NAME that the last page marks selected.
me_selected() {
	perl -0777 -ne '
		if (/<select\b[^>]*\bname="'"$1"'".*?<\/select>/s) {
			my $s = $&;
			print $1 if $s =~ /<option\b[^>]*\bvalue="([^"]*)"[^>]*\bselected/s;
		}' "$work/b"
}

# me_help NAME: the help text printed under the select NAME (the element its
# aria-describedby names). The translations also travel in the page's data, so
# a check on a sentence has to read the element and not the whole page.
me_help() {
	local id
	id=$(perl -0777 -ne 'if (/<select\b[^>]*\bname="'"$1"'"[^>]*>/s) { print $1 if $& =~ /aria-describedby="([^" ]*)/ }' "$work/b")
	[[ -n "$id" ]] || return 0
	perl -0777 -ne 'print $1 if /<p\b[^>]*\bid="'"$id"'"[^>]*>([^<]*)</s' "$work/b"
}

# html_lang: the lang of the html element of the last page.
me_html_lang() {
	{ grep -o '<html[^>]*>' "$work/b" || true; } | head -1 | { grep -o 'lang="[^"]*"' || true; } | sed 's/lang="//; s/"$//'
}

# html_theme: the data-theme of the html element of the last page, or nothing.
me_html_theme() {
	{ grep -o '<html[^>]*>' "$work/b" || true; } | head -1 |
		{ grep -o 'data-theme="[^"]*"' || true; } | sed 's/data-theme="//; s/"$//'
}

scenario_me() {
	echo "# me: the person's own page is gated like the mail area, serves a plain form, and the action refuses what no list holds"
	fresh
	login admin correct-horse
	local admin_cookie=$cookie
	login user plain-staple
	local user_cookie=$cookie
	set_404_reference
	local path code bad

	# --- no session: the sign-in page, for the page and for a post, and nothing is written
	for path in /app/me /app/me/x /APP/ME /app/Me /app/m%65; do
		fetch "$path"
		assert_eq "no session, GET $path: redirected" "$status" 307
		assert_eq "no session, GET $path: to the sign-in page" "$(header location)" "/"
	done
	fetch /app/me "$SESSION_COOKIE_NAME=forged.token"
	assert_eq "a forged session cookie: redirected" "$status" 307
	assert_eq "a forged session cookie: to the sign-in page" "$(header location)" "/"
	reset_log
	me_post "" language=de theme=dark density=compact remoteImages=ask timeZone=UTC
	assert_eq "no session, post: redirected" "$status" 307
	assert_eq "no session, post: to the sign-in page" "$(header location)" "/"
	assert_eq "no session, post: no preference cookie is written" "$(me_prefs_set_count)" 0
	assert_eq "no session: the mail server saw nothing" "$(api_count '"path"')" 0

	# --- a session: the exact route and nothing under it
	for path in /app/me/x /app/Me /APP/ME /app/m%65 '/app/me;x'; do
		assert_hidden "session, GET $path" "$path" "$admin_cookie"
	done

	# --- both roles reach the page, with the plain form, never indexed, no inline style
	local cookie_of role lang_selects
	for role in admin user; do
		cookie_of=$admin_cookie
		[[ "$role" == "user" ]] && cookie_of=$user_cookie
		fetch /app/me "$cookie_of"
		assert_eq "$role session, GET /app/me" "$status" 200
		# One slash at the end is the framework's own redirect to the route, before the proxy.
		fetch /app/me/ "$cookie_of"
		assert_eq "$role session, GET /app/me/: moved to the route" "$(header location)" "/app/me"
		fetch /app/me "$cookie_of"
		assert_contains "$role: the page is the preferences page" "$(cat "$work/b")" '<h1 class="font-semibold text-lg">Preferences</h1>'
		assert_contains "$role: it is not indexed (header)" "$(header x-robots-tag)" "noindex"
		assert_contains "$role: it is not indexed (meta)" "$(cat "$work/b")" 'name="robots" content="noindex'
		assert_eq "$role: no inline style attribute or element" \
			"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
		assert_eq "$role: no script tag without the nonce" \
			"$(unnonced_scripts "$work/b" "$(nonce_of_csp "$(header content-security-policy)")")" 0
		assert_contains "$role: the form posts to itself, as multipart, with no script" "$(cat "$work/b")" 'encType="multipart/form-data" method="POST"'
		for field in language theme density remoteImages timeZone pageSize refresh; do
			assert_contains "$role: the $field select is required" "$(perl -0777 -ne "print \$& if /<select\\b[^>]*name=\"$field\"[^>]*>/" "$work/b")" 'required'
		done
		assert_eq "$role: the language in force is the browser's default, English" "$(me_selected language)" en
		assert_eq "$role: the theme in force is the system's" "$(me_selected theme)" system
		assert_eq "$role: the density in force is the comfortable one" "$(me_selected density)" comfortable
		assert_eq "$role: time zone defaults to UTC" "$(me_selected timeZone)" UTC
		assert_eq "$role: remote images ask before loading" "$(me_selected remoteImages)" ask
		assert_eq "$role: the page holds 50 messages, as the list always did" "$(me_selected pageSize)" 50
		assert_eq "$role: the lists refresh at the normal pace" "$(me_selected refresh)" normal
		assert_eq "$role: the document says its language" "$(me_html_lang)" en
		assert_eq "$role: and pins no theme" "$(me_html_theme)" ""
	done
	fetch /app/me "$admin_cookie"
	assert_contains "an admin's header points to the page" "$(perl -0777 -ne 'print $1 if /(<header\b.*?<\/header>)/s' "$work/b")" 'href="/app/me"'
	assert_contains "an admin's sidebar has the way into the administration" "$(cat "$work/b")" "href=\"$adm\""
	fetch /app/me "$user_cookie"
	assert_absent "a user's page has no way into the administration" "$(cat "$work/b")" "$admin_id"

	# --- each choice of each list is stored, with the attributes of its cookie, by a plain post
	local locale theme density lines
	for locale in $(me_locales_of); do
		me_post "$admin_cookie" "language=$locale" theme=system density=comfortable remoteImages=ask timeZone=UTC
		assert_eq "$locale: the plain post is answered" "$status" 200
		assert_eq "$locale: seven preference cookies are written" "$(me_prefs_set_count)" 7
		lines=$(me_prefs_set)
		assert_contains "$locale: the locale cookie holds it, out of reach of a script, for the whole site" "$lines" "locale=$locale; Path=/;"
		assert_contains "$locale: and lives a year over HTTPS only, to the same site only" "$(grep -i '^set-cookie: locale=' "$work/h")" "Max-Age=31536000; Secure; HttpOnly; SameSite=lax"
		assert_eq "$locale: the answering page is already in that language" "$(me_html_lang)" "$locale"
		assert_eq "$locale: and shows it selected" "$(me_selected language)" "$locale"
		fetch /app/me "$user_cookie; locale=$locale"
		assert_eq "$locale: the next page, with the cookie, is in it" "$(me_html_lang)" "$locale"
	done
	for theme in $(me_themes_of); do
		me_post "$user_cookie" language=en "theme=$theme" density=comfortable remoteImages=ask timeZone=UTC
		assert_eq "$theme: the plain post is answered" "$status" 200
		assert_contains "$theme: the theme cookie holds it, readable by script, for the whole site" "$(grep -i '^set-cookie: theme=' "$work/h" | tr -d '\r')" "theme=$theme; Path=/;"
		assert_absent "$theme: the theme cookie is not HttpOnly" "$(grep -i '^set-cookie: theme=' "$work/h")" "HttpOnly"
		if [[ "$theme" == "system" ]]; then
			assert_eq "$theme: the answering page pins no theme" "$(me_html_theme)" ""
		else
			assert_eq "$theme: the answering page is already in it, with no flash of the other" "$(me_html_theme)" "$theme"
		fi
		assert_eq "$theme: and shows it selected" "$(me_selected theme)" "$theme"
	done
	for density in $(me_densities_of); do
		me_post "$admin_cookie" language=en theme=system "density=$density" remoteImages=ask timeZone=UTC
		assert_eq "$density: the plain post is answered" "$status" 200
		assert_contains "$density: the density cookie holds it, out of reach of a script, under /app only" "$(grep -i '^set-cookie: list-density=' "$work/h" | tr -d '\r')" "list-density=$density; Path=/app;"
		assert_contains "$density: with the attributes of the others" "$(grep -i '^set-cookie: list-density=' "$work/h")" "Max-Age=31536000; Secure; HttpOnly; SameSite=lax"
		assert_eq "$density: and shows it selected" "$(me_selected density)" "$density"
	done
	local remote_images
	for remote_images in $(me_remote_images_of); do
		me_post "$user_cookie" language=en theme=system density=comfortable "remoteImages=$remote_images" timeZone=UTC
		assert_eq "$remote_images: the plain post is answered" "$status" 200
		assert_eq "$remote_images: seven preference cookies" "$(me_prefs_set_count)" 7
		assert_contains "$remote_images: private app cookie" "$(grep -i '^set-cookie: remote-images=' "$work/h" | tr -d '\r')" "remote-images=$remote_images; Path=/app;"
		assert_contains "$remote_images: secure cookie for a year" "$(grep -i '^set-cookie: remote-images=' "$work/h")" "Max-Age=31536000; Secure; HttpOnly; SameSite=lax"
		assert_eq "$remote_images: the answering page shows it" "$(me_selected remoteImages)" "$remote_images"
		fetch /app/me "$user_cookie; remote-images=$remote_images"
		assert_eq "$remote_images: the next read shows it" "$(me_selected remoteImages)" "$remote_images"
	done
	me_post "$admin_cookie" language=de theme=dark density=compact remoteImages=ask timeZone=UTC
	assert_contains "a saved post says so, in the language just chosen" "$(cat "$work/b")" 'role="status"'
	fetch /app/me "$admin_cookie; locale=de; theme=dark; list-density=compact; remote-images=never; time-zone=America%2FBogota; page-size=25; refresh=fast"
	assert_eq "the next read has the seven in force: language" "$(me_selected language)" de
	assert_eq "the next read has the seven in force: theme" "$(me_selected theme)" dark
	assert_eq "the next read has the seven in force: density" "$(me_selected density)" compact
	assert_eq "the next read has the seven in force: remote images" "$(me_selected remoteImages)" never
	assert_eq "the next read has the seven in force: time zone" "$(me_selected timeZone)" America/Bogota
	assert_eq "the next read has the seven in force: page size" "$(me_selected pageSize)" 25
	assert_eq "the next read has the seven in force: refresh pace" "$(me_selected refresh)" fast
	assert_eq "and paints the theme on the html element" "$(me_html_theme)" dark

	# --- a value no list holds is refused by the action, named under its field, and stores none of the seven
	local field value hostile
	local -A good=([language]=es [theme]=dark [density]=compact [remoteImages]=never [timeZone]=America/Bogota [pageSize]=25 [refresh]=fast)
	for field in language theme density remoteImages timeZone pageSize refresh; do
		for hostile in 'xx' 'ES' 'Dark' ' compact' 'dark; Path=/' '../es' '__proto__' "$(printf 'e%.0s' $(seq 1 5000))" '%00' 'dark,light' 'e2emarker' '"><e2emarker>' 'e2emarker-es'; do
			value=$hostile
			local args=()
			for name in language theme density remoteImages timeZone pageSize refresh; do
				if [[ "$name" == "$field" ]]; then
					args+=("$name=$value")
				else
					args+=("$name=${good[$name]}")
				fi
			done
			me_post "$admin_cookie" "${args[@]}"
			assert_eq "$field=${value:0:12}: the action answers" "$status" 200
			assert_eq "$field=${value:0:12}: no preference cookie is written, whatever the other six hold" "$(me_prefs_set_count)" 0
			assert_contains "$field=${value:0:12}: the answer names the refusal under the field" "$(perl -0777 -ne 'print $& while /role="alert"[^>]*>[^<]*<\/p>/g' "$work/b")" 'That is not one of the choices.'
			assert_contains "$field=${value:0:12}: and says nothing was saved" "$(cat "$work/b")" 'Nothing was saved.'
			if [[ "$value" == *e2emarker* ]]; then
				assert_absent "$field=${value:0:12}: the refused text is not printed back" "$(cat "$work/b")" "e2emarker"
			fi
		done
	done
	# a field missing, empty, repeated or twice with a good one first
	me_post "$admin_cookie" theme=dark density=compact remoteImages=ask timeZone=UTC
	assert_eq "language missing: no preference cookie" "$(me_prefs_set_count)" 0
	assert_contains "language missing: the answer asks for a choice" "$(cat "$work/b")" 'Choose one.'
	me_post "$admin_cookie" language= theme=dark density=compact remoteImages=ask timeZone=UTC
	assert_eq "language empty: no preference cookie" "$(me_prefs_set_count)" 0
	assert_contains "language empty: the answer asks for a choice" "$(cat "$work/b")" 'Choose one.'
	me_post "$admin_cookie" language=es language=de theme=dark density=compact remoteImages=ask timeZone=UTC
	assert_eq "language twice, the first a good one: no preference cookie" "$(me_prefs_set_count)" 0
	assert_contains "language twice: named as outside the list" "$(cat "$work/b")" 'That is not one of the choices.'
	me_post "$admin_cookie" language=es theme=bogus density=bogus remoteImages=ask timeZone=UTC
	assert_eq "two fields refused: no preference cookie" "$(me_prefs_set_count)" 0
	assert_eq "two fields refused: both are named, each under its own field" \
		"$(grep -o -E 'role="alert"[^>]*>That is not one of the choices\.</p>' "$work/b" | wc -l | tr -d ' ')" 2
	me_post "$admin_cookie" language=es theme=dark density=compact 'extra=admin' 'role=admin' remoteImages=ask timeZone=UTC
	assert_eq "an unknown field is ignored: the seven are stored" "$(me_prefs_set_count)" 7

	for value in missing empty duplicate; do
		local remote_args=()
		case "$value" in
			empty) remote_args+=(remoteImages=) ;;
			duplicate) remote_args+=(remoteImages=never remoteImages=always) ;;
		esac
		me_post "$admin_cookie" language=en theme=system density=comfortable timeZone=UTC "${remote_args[@]}"
		assert_eq "remote images $value: no preference cookie" "$(me_prefs_set_count)" 0
		if [[ "$value" == duplicate ]]; then
			assert_contains "remote images $value: outside list" "$(cat "$work/b")" 'That is not one of the choices.'
		else
			assert_contains "remote images $value: required" "$(cat "$work/b")" 'Choose one.'
		fi
	done


	# --- sixth and seventh fields: the page size and the refresh pace, each choice of each list, no off
	local page_size pace
	for page_size in $(me_page_sizes_of); do
		me_post "$user_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC "pageSize=$page_size"
		assert_eq "page size $page_size: the plain post is answered" "$status" 200
		assert_eq "page size $page_size: seven preference cookies" "$(me_prefs_set_count)" 7
		assert_contains "page size $page_size: private app cookie" "$(grep -i '^set-cookie: page-size=' "$work/h" | tr -d '\r')" "page-size=$page_size; Path=/app;"
		assert_contains "page size $page_size: secure cookie for a year" "$(grep -i '^set-cookie: page-size=' "$work/h")" "Max-Age=31536000; Secure; HttpOnly; SameSite=lax"
		assert_eq "page size $page_size: the answering page shows it" "$(me_selected pageSize)" "$page_size"
		fetch /app/me "$user_cookie; page-size=$page_size"
		assert_eq "page size $page_size: the next read shows it" "$(me_selected pageSize)" "$page_size"
	done
	for pace in $(me_refresh_paces_of); do
		me_post "$user_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC "refresh=$pace"
		assert_eq "refresh $pace: the plain post is answered" "$status" 200
		assert_eq "refresh $pace: seven preference cookies" "$(me_prefs_set_count)" 7
		assert_contains "refresh $pace: private app cookie" "$(grep -i '^set-cookie: refresh=' "$work/h" | tr -d '\r')" "refresh=$pace; Path=/app;"
		assert_contains "refresh $pace: secure cookie for a year" "$(grep -i '^set-cookie: refresh=' "$work/h")" "Max-Age=31536000; Secure; HttpOnly; SameSite=lax"
		assert_eq "refresh $pace: the answering page shows it" "$(me_selected refresh)" "$pace"
		fetch /app/me "$user_cookie; refresh=$pace"
		assert_eq "refresh $pace: the next read shows it" "$(me_selected refresh)" "$pace"
	done
	assert_eq "the refresh offers three paces and no off" "$(me_refresh_paces_of)" "normal slow fast"
	for value in missing empty duplicate same-duplicate; do
		local size_args=() refresh_args=()
		case "$value" in
			missing) size_args+=(-pageSize); refresh_args+=(-refresh) ;;
			empty) size_args+=(pageSize=); refresh_args+=(refresh=) ;;
			duplicate) size_args+=(pageSize=25 pageSize=100); refresh_args+=(refresh=slow refresh=fast) ;;
			same-duplicate) size_args+=(pageSize=50 pageSize=50); refresh_args+=(refresh=normal refresh=normal) ;;
		esac
		me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC "${size_args[@]}"
		assert_eq "page size $value: no preference cookie" "$(me_prefs_set_count)" 0
		me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC "${refresh_args[@]}"
		assert_eq "refresh $value: no preference cookie" "$(me_prefs_set_count)" 0
		if [[ "$value" == *duplicate ]]; then
			assert_contains "refresh $value: outside list" "$(cat "$work/b")" 'That is not one of the choices.'
		else
			assert_contains "refresh $value: required" "$(cat "$work/b")" 'Choose one.'
		fi
	done
	for value in 10 75 050 50.0 ' 50' 1e2 -25; do
		me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC "pageSize=$value"
		assert_eq "page size '$value': no preference cookie" "$(me_prefs_set_count)" 0
		assert_contains "page size '$value': outside list" "$(cat "$work/b")" 'That is not one of the choices.'
	done
	for value in off never 0 Fast ' slow' e2emarker; do
		me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC "refresh=$value"
		assert_eq "refresh '$value': no preference cookie" "$(me_prefs_set_count)" 0
		assert_contains "refresh '$value': outside list" "$(cat "$work/b")" 'That is not one of the choices.'
	done
	fetch /app/me "$admin_cookie; page-size=9999; refresh=off"
	assert_eq "tampered page size falls back to 50" "$(me_selected pageSize)" 50
	assert_eq "a refresh of off in a cookie falls back to normal: there is no off" "$(me_selected refresh)" normal
	fetch /app/me "$admin_cookie; page-size=%22%3E%3Ce2emarker%3E; refresh=%22%3E%3Ce2emarker%3E"
	assert_eq "tampered page size is not echoed" "$(grep -c e2emarker "$work/b" || true)" 0

	# --- fifth field: fixed examples include a half-hour offset and the date line
	local time_zone encoded_zone
	for time_zone in UTC America/Bogota Asia/Kolkata Pacific/Kiritimati; do
		me_post "$user_cookie" language=en theme=system density=comfortable remoteImages=ask "timeZone=$time_zone"
		assert_eq "$time_zone: the plain post is answered" "$status" 200
		assert_eq "$time_zone: seven preference cookies" "$(me_prefs_set_count)" 7
		encoded_zone=${time_zone//\//%2F}
		assert_contains "$time_zone: private app cookie" "$(grep -i '^set-cookie: time-zone=' "$work/h" | tr -d '\r')" "time-zone=$encoded_zone; Path=/app;"
		assert_contains "$time_zone: secure cookie for a year" "$(grep -i '^set-cookie: time-zone=' "$work/h")" "Max-Age=31536000; Secure; HttpOnly; SameSite=lax"
		assert_eq "$time_zone: the answering page shows it" "$(me_selected timeZone)" "$time_zone"
		fetch /app/me "$user_cookie; time-zone=$encoded_zone"
		assert_eq "$time_zone: the next read shows it" "$(me_selected timeZone)" "$time_zone"
	done
	for value in missing empty duplicate same-duplicate; do
		local zone_args=()
		case "$value" in
			empty) zone_args+=(timeZone=) ;;
			duplicate) zone_args+=(timeZone=UTC timeZone=America/Bogota) ;;
			same-duplicate) zone_args+=(timeZone=UTC timeZone=UTC) ;;
		esac
		me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask "${zone_args[@]}"
		assert_eq "time zone $value: no preference cookie" "$(me_prefs_set_count)" 0
		if [[ "$value" == *duplicate ]]; then
			assert_contains "time zone $value: outside list" "$(cat "$work/b")" 'That is not one of the choices.'
		else
			assert_contains "time zone $value: required" "$(cat "$work/b")" 'Choose one.'
		fi
	done
	for time_zone in Mars/Base utc ' UTC ' ../ Etc/GMT+14; do
		me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask "timeZone=$time_zone"
		assert_eq "$time_zone: no preference cookie" "$(me_prefs_set_count)" 0
		assert_contains "$time_zone: outside list" "$(cat "$work/b")" 'That is not one of the choices.'
	done
	fetch /app/me "$admin_cookie; time-zone=%22%3E%3Ce2e-zone-marker%3E"
	assert_eq "tampered time zone falls back" "$(me_selected timeZone)" UTC
	assert_absent "tampered time zone is not echoed" "$(cat "$work/b")" e2e-zone-marker

	# --- the state of the form posted back is not believed, and a tampered cookie is never printed
	fetch /app/me "$admin_cookie; locale=ES; theme=\"><script>alert(1)</script>; list-density=huge; remote-images=\"><e2emarker>"
	assert_eq "tampered cookies: the page still renders" "$status" 200
	assert_eq "tampered cookies: the language falls back" "$(me_selected language)" en
	assert_eq "tampered cookies: the theme falls back" "$(me_selected theme)" system
	assert_eq "tampered cookies: the density falls back" "$(me_selected density)" comfortable
	assert_absent "tampered cookies: nothing of them is printed" "$(cat "$work/b")" "alert(1)"
	assert_eq "tampered remote images fall back" "$(me_selected remoteImages)" ask
	assert_absent "tampered remote images are not printed" "$(cat "$work/b")" "e2emarker"
	assert_eq "tampered cookies: no data-theme" "$(me_html_theme)" ""

	# --- the action is a public endpoint: reached only through the page, which the proxy gates, and
	# --- it checks the session itself too; called with other arguments than the form's it stores nothing
	local action_field
	action_field="\$ACTION_ID_$(action_id features/preferences/actions/save-preferences/index.ts)"
	curl -s -o "$work/b" -D "$work/h" "$panel/app/me" -b "$SESSION_COOKIE_NAME=forged.token" \
		--form-string "$action_field=" --form-string language=de --form-string theme=dark --form-string density=compact --form-string remoteImages=ask --form-string timeZone=UTC --form-string pageSize=50 --form-string refresh=normal
	assert_eq "a post with a forged session writes no preference" "$(me_prefs_set_count)" 0
	code=$(curl -s -o "$work/b" -D "$work/h" -w '%{http_code}' -b "$user_cookie" "$panel/app/me" \
		--form-string "$action_field=" --form-string language=de --form-string theme=dark --form-string density=compact --form-string remoteImages=ask --form-string timeZone=UTC --form-string pageSize=50 --form-string refresh=normal)
	assert_eq "the action called without its state argument does not fail" "$code" 200
	assert_eq "the action called without its state argument stores nothing" "$(me_prefs_set_count)" 0

	# --- the operator can fix the page size and the refresh pace for everyone; a value off the list stops the start
	for bad in 30 e2emarker; do
		cdn_start_refused "EPISTLE_PANEL_PAGE_SIZE=$bad"
		assert_eq "page size '$bad' fixed by the operator stops the start" "$refused_status" 1
		assert_contains "page size '$bad': the message names the variable" "$refused_log" "EPISTLE_PANEL_PAGE_SIZE is set to a page size the panel does not support"
	done
	assert_absent "a refused page size is not printed" "$refused_log" "e2emarker"
	for bad in off FAST e2emarker; do
		cdn_start_refused "EPISTLE_PANEL_REFRESH=$bad"
		assert_eq "refresh '$bad' fixed by the operator stops the start" "$refused_status" 1
		assert_contains "refresh '$bad': the message names the variable" "$refused_log" "EPISTLE_PANEL_REFRESH is set to a pace the panel does not support"
	done
	assert_absent "a refused pace is not printed" "$refused_log" "e2emarker"
	panel_env=(EPISTLE_PANEL_PAGE_SIZE=100 EPISTLE_PANEL_REFRESH=slow)
	start_panel
	fetch /app/me "$admin_cookie; page-size=25; refresh=fast"
	assert_eq "fixed by the operator: the page is served" "$status" 200
	assert_eq "fixed page size: no select is offered" "$({ grep -o 'name="pageSize"' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	assert_eq "fixed pace: no select is offered" "$({ grep -o 'name="refresh"' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	assert_contains "fixed page size: the page says the operator's, not the cookie's" "$(cat "$work/b")" 'Set by the operator: 100 messages'
	assert_contains "fixed pace: the page says the operator's, not the cookie's" "$(cat "$work/b")" 'Set by the operator: Slow: half as often'
	me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC -pageSize -refresh
	assert_eq "fixed by the operator: the rest is saved, and only the five that are the person's" "$(me_prefs_set_count)" 5
	assert_absent "fixed by the operator: no page-size cookie is written" "$(me_prefs_set)" "page-size="
	assert_absent "fixed by the operator: no refresh cookie is written" "$(me_prefs_set)" "refresh="
	me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC pageSize=25 -refresh
	assert_eq "a page size posted over the operator's: no preference cookie" "$(me_prefs_set_count)" 0
	assert_contains "a page size posted over the operator's: refused" "$(cat "$work/b")" 'That is not one of the choices.'
	me_post "$admin_cookie" language=en theme=system density=comfortable remoteImages=ask timeZone=UTC -pageSize refresh=fast
	assert_eq "a pace posted over the operator's: no preference cookie" "$(me_prefs_set_count)" 0
	assert_contains "a pace posted over the operator's: refused" "$(cat "$work/b")" 'That is not one of the choices.'
	# --- a short idle timeout cannot be kept alive by a slow refresh: the page says "slow" runs as "normal"
	# --- (read from the page, not by waiting a minute). Sessions need the activity claims of the idle timeout, so sign in again.
	local idle_cookie note='idle timeout this short'
	panel_env=(EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES=1)
	start_panel
	login admin correct-horse
	idle_cookie=$cookie
	for pace in slow normal fast; do
		fetch /app/me "$idle_cookie; refresh=$pace"
		assert_eq "idle timeout of 1 minute, $pace chosen: the page is served" "$status" 200
		assert_eq "idle timeout of 1 minute, $pace chosen: the select still shows it" "$(me_selected refresh)" "$pace"
		if [[ "$pace" == slow ]]; then
			assert_contains "idle timeout of 1 minute: slow is said to run as normal" "$(me_help refresh)" "$note"
		else
			assert_absent "idle timeout of 1 minute, $pace: nothing is said" "$(me_help refresh)" "$note"
			assert_contains "idle timeout of 1 minute, $pace: the help is there to be read" "$(me_help refresh)" "never off"
		fi
	done
	panel_env=(EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES=3)
	start_panel
	login admin correct-horse
	idle_cookie=$cookie
	fetch /app/me "$idle_cookie; refresh=slow"
	assert_eq "idle timeout of 3 minutes, slow chosen: the select shows it" "$(me_selected refresh)" slow
	assert_absent "idle timeout of 3 minutes: slow runs as slow, nothing is said" "$(me_help refresh)" "$note"
	assert_contains "idle timeout of 3 minutes: the help is there to be read" "$(me_help refresh)" "never off"
	panel_env=(EPISTLE_PANEL_SESSION_IDLE_TIMEOUT_MINUTES=1 EPISTLE_PANEL_REFRESH=slow)
	start_panel
	login admin correct-horse
	idle_cookie=$cookie
	fetch /app/me "$idle_cookie; refresh=fast"
	assert_contains "idle timeout of 1 minute, operator slow: the read-only text says it runs as normal" "$(cat "$work/b")" "Slow: half as often With the session"
	assert_eq "idle timeout of 1 minute, operator slow: no select is offered" "$({ grep -o 'name="refresh"' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	panel_env=()
	start_panel
}
