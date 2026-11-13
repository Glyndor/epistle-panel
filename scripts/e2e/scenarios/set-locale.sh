# shellcheck shell=bash disable=SC2154,SC2034
# Scenario set-locale of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# Number of Set-Cookie headers of the last request that name the locale cookie.
locale_cookies_set() {
	{ grep -i '^set-cookie: locale=' "$work/h" || true; } | wc -l | tr -d ' '
}

# supported_locales: the locales the panel ships, read from the one list in
# internal/src/i18n/locales/index.ts so this scenario never keeps its own copy.
supported_locales() {
	node -e '
		const src = require("node:fs").readFileSync(process.argv[1], "utf8");
		const list = /SUPPORTED_LOCALES = \[([^\]]*)\]/.exec(src)[1];
		process.stdout.write([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]).join(" "));
	' "$internal/src/i18n/locales/index.ts"
}

# queue_heading LOCALE: the heading of the queue page in that locale's catalog.
queue_heading() {
	node -e '
		process.stdout.write(require(process.argv[1]).heading);
	' "$internal/src/i18n/messages/$1/queue.json"
}

scenario_set_locale() {
	echo "# set-locale Server Action: a language the panel does not have changes nothing"
	fresh
	login admin correct-horse
	local good=$cookie code
	local file=features/locale/actions/set-locale/index.ts
	reset_api

	code=$(post_action "$file" '["xx"]' "$good")
	assert_eq "an unknown language with a session: the action runs" "$code" 200
	assert_contains "an unknown language answers false" "$(cat "$work/b")" '1:false'
	assert_eq "an unknown language writes no locale cookie" "$(locale_cookies_set)" 0

	code=$(post_action "$file" '["../es"]' "$good")
	assert_contains "a path-like language answers false" "$(cat "$work/b")" '1:false'
	assert_eq "a path-like language writes no locale cookie" "$(locale_cookies_set)" 0

	local hostile
	for hostile in '["ES"]' '["Pt"]' '["pt-BR"]' '["../../etc/passwd"]' '["es; Path=/"]' '["__proto__"]' \
		"[\"$(printf 'e%.0s' $(seq 1 5000))\"]"; do
		code=$(post_action "$file" "$hostile" "$good")
		assert_contains "a hostile language ${hostile:0:24} answers false" "$(cat "$work/b")" '1:false'
		assert_eq "a hostile language ${hostile:0:24} writes no locale cookie" "$(locale_cookies_set)" 0
	done

	local locale
	for locale in $(supported_locales); do
		code=$(post_action "$file" "[\"$locale\"]" "$good")
		assert_contains "$locale: a language the panel has answers true" "$(cat "$work/b")" '1:true'
		assert_eq "$locale: a language the panel has writes the locale cookie" "$(locale_cookies_set)" 1

		fetch /app/queue "$good; locale=$locale"
		assert_eq "$locale: the queue page renders" "$status" 200
		assert_contains "$locale: the document says its language" "$(cat "$work/b")" "<html lang=\"$locale\""
		assert_contains "$locale: the queue heading is that locale's" "$(cat "$work/b")" "$(queue_heading "$locale")"
	done

	code=$(post_action "$file" '["es"]')
	assert_eq "no session: the action is redirected to the sign-in" "$code" 307
	assert_eq "no session: no locale cookie" "$(locale_cookies_set)" 0
	code=$(post_action "$file" '["xx"]')
	assert_eq "no session and an unknown language: redirected too" "$code" 307
	assert_eq "no session and an unknown language: no locale cookie" "$(locale_cookies_set)" 0
}
