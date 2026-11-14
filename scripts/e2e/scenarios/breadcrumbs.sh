# shellcheck shell=bash disable=SC2154,SC2034
# Scenario breadcrumbs of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# trails_html: every breadcrumb navigation of the last page, one per line. A
# streamed page holds two: the one of its loading state, sent first, and the
# one of the page itself.
trails_html() {
	perl -0777 -ne 'while (/(<nav aria-label="Breadcrumb".*?<\/nav>)/sg) { (my $t = $1) =~ s/\n/ /g; print "$t\n" }' "$work/b"
}

# trail_html: the trail of the page itself, the last one in the response.
trail_html() {
	trails_html | tail -1
}

# count_in TEXT PATTERN: how many times the fixed string PATTERN is in TEXT.
count_in() {
	printf '%s' "$1" | { grep -o -F -- "$2" || true; } | wc -l | tr -d ' '
}

scenario_breadcrumbs() {
	echo "# breadcrumbs: every admin page is served with the trail to itself, built from the admin routes"
	fresh
	login admin correct-horse
	local good=$cookie trail entry path label
	for entry in ":Status" "/domains:Domains" "/accounts:Accounts" "/queue:Queue" "/suppression:Suppression" "/deliveries:Deliveries"; do
		path=${entry%%:*}
		label=${entry#*:}
		fetch "$adm$path" "$good"
		assert_eq "GET $adm$path" "$status" 200
		trail=$(trail_html)
		assert_eq "$label: the loading state sent first and the page draw the same trail" "$(trails_html | sort -u | wc -l | tr -d ' ')" 1
		assert_contains "$label: the trail starts at the administration, linked with the id" "$trail" "href=\"$adm\">Administration</a>"
		assert_eq "$label: one link in the trail" "$(count_in "$trail" '<a ')" 1
		assert_eq "$label: one current page" "$(count_in "$trail" 'aria-current="page"')" 1
		assert_contains "$label: the current page is this one" "$trail" ">$label</span>"
		assert_absent "$label: no inline style in the trail" "$trail" 'style='
	done

	# A loading state wraps the folders below it: none may be another page's first paint.
	fetch "$adm/domains" "$good"
	assert_absent "the domains page is not served with the status page's heading first" "$(cat "$work/b")" '>Status</h1>'
	assert_absent "nor with the status page's trail" "$(trails_html)" '>Status</span>'

	# A page about one thing: the page is a link and the thing is the current step.
	fetch "$adm/accounts/admin" "$good"
	assert_eq "GET the account page" "$status" 200
	trail=$(trail_html)
	assert_contains "account: the administration is linked" "$trail" "href=\"$adm\">Administration</a>"
	assert_contains "account: the accounts list is linked" "$trail" "href=\"$adm/accounts\">Accounts</a>"
	assert_eq "account: two links" "$(count_in "$trail" '<a ')" 2
	assert_eq "account: one current page" "$(count_in "$trail" 'aria-current="page"')" 1
	assert_contains "account: the current step is the account" "$trail" ">admin</span>"
	trail=$(trails_html | head -1)
	assert_eq "account: its loading state, sent first, links the same two steps" "$(count_in "$trail" '<a ')" 2
	assert_eq "account: and names no current page, not knowing the account yet" "$(count_in "$trail" 'aria-current="page"')" 0
	assert_absent "account: the loading state is the account's own, not the list's" "$(cat "$work/b")" '>Accounts</h1>'

	# A hostile account name reaches no trail: the page is the not-found one.
	local hostile
	for hostile in '..%2fqueue' '%3Cscript%3E' 'Admin' 'a%0d%0ab'; do
		fetch "$adm/accounts/$hostile" "$good"
		assert_eq "a name that is no account ($hostile): no trail names it as a page" "$(count_in "$(trails_html)" 'aria-current="page"')" 0
		assert_absent "a name that is no account ($hostile): no script from it" "$(cat "$work/b")" '<script>alert'
	done

	# Without a session there is no page, so no trail and no id.
	set_404_reference
	assert_hidden "no session: the queue page" "$adm/queue"
	fetch "$adm/queue"
	assert_eq "no session: no trail" "$(count_in "$(cat "$work/b")" 'aria-label="Breadcrumb"')" 0
}
