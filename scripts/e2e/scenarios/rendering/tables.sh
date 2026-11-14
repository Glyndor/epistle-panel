# shellcheck shell=bash disable=SC2154,SC2034
# Scenario tables of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.
#
# Paging and the facets live in the browser, so curl cannot press them. What
# this proves is what the built server sends of a list longer than a page: the
# first page only, the range, the controls and the facet labels. Pressing them
# is a browser check (docs/maintainers/e2e.md).

# seed_api JSON: add rows to the stand-in's lists, and print the status.
seed_api() {
	curl -s -o /dev/null -w '%{http_code}' -X POST "$api/__control/seed" -d "$1"
}

# count_in TEXT NEEDLE: how many times the fixed string NEEDLE is in TEXT.
count_in() {
	{ printf '%s' "$1" | grep -o -F "$2" || true; } | wc -l | tr -d ' '
}

scenario_tables() {
	echo "# tables: the first page of a long list as the server sends it, its controls and its facets"
	fresh
	login admin correct-horse
	local good=$cookie body
	reset_api
	assert_eq "129 more accounts and 60 more domains are seeded" "$(seed_api '{"accounts":129,"domains":60}')" 200

	# --- accounts: 132 rows, 25 a page
	fetch "$adm/accounts" "$good"
	body=$(cat "$work/b")
	assert_eq "GET $adm/accounts with 132 accounts" "$status" 200
	assert_eq "the page holds the 25 rows of the first page" "$(count_in "$body" 'aria-label="Actions for ')" 25
	assert_contains "its last row is the 25th account" "$body" 'aria-label="Actions for seed-022"'
	assert_absent "the 26th is not sent" "$body" 'aria-label="Actions for seed-023"'
	assert_contains "the range says which rows these are" "$body" "1–25 of 132"
	assert_eq "one live region says a change of the rows, empty until there is one" "$(count_in "$body" '<p class="sr-only" aria-live="polite" aria-atomic="true"></p>')" 1
	assert_eq "and nothing else in the page is one" "$(count_in "$body" 'aria-live="polite"')" "$(count_in "$body" '<p class="sr-only" aria-live="polite" aria-atomic="true">')"
	assert_contains "the filter field is named" "$body" 'name="filter"'
	assert_contains "the count says all 132 match" "$body" "132 of 132 rows"
	assert_contains "the page controls are a named landmark" "$body" 'aria-label="Pages of the table"'
	assert_eq "with one button per page" "$(count_in "$body" 'data-slot="pagination-link"')" 6
	assert_eq "of which one is the current page" "$(count_in "$body" 'aria-current="page" data-slot="pagination-link"')" 1
	assert_contains "previous has nowhere to go on the first page" "$body" 'aria-disabled="true" data-slot="pagination-previous"'
	assert_absent "next has" "$body" 'aria-disabled="true" data-slot="pagination-next"'
	assert_contains "a narrow window gets the page in words" "$body" "Page 1 of 6"
	assert_contains "the size starts at 25" "$body" '<option data-slot="native-select-option" value="25" selected="">25</option>'
	assert_eq "and offers 10, 25, 50 and 100" "$(count_in "$body" 'data-slot="native-select-option"')" 4
	assert_contains "the Filters button is sent with the page" "$body" 'Filters</button>'
	# The page holds ops and seed-004 to seed-020: six accounts of the
	# configuration file, each saying so under its name and in its column.
	assert_eq "the origin of each account is in its row" "$(count_in "$body" '>Configuration file</span>')" 12
	assert_absent "no inline style" "$body" ' style="'
	assert_eq "the page asked the API for the list once, whole" "$(api_count '"path":"/api/v1/accounts"')" 1

	# --- domains: 61 rows, every third seeded one switched off
	fetch "$adm/domains" "$good"
	body=$(cat "$work/b")
	assert_eq "GET $adm/domains with 61 domains" "$status" 200
	assert_contains "the range says 1 to 25 of 61" "$body" "1–25 of 61"
	# The whole list is in the page as data for the browser's cache; a row is
	# the name in its cell.
	assert_contains "the last row of the page is the 25th domain" "$body" '>d024.example.test</span>'
	assert_absent "the 26th has no row" "$body" '>d025.example.test</span>'
	assert_eq "the 8 switched-off domains of the page say so" "$(count_in "$body" '>Switched off</span>')" 8
	assert_eq "and the other 17 say they are active" "$(count_in "$body" '>Active</span>')" 17
	assert_contains "the Filters button is sent with the page" "$body" 'Filters</button>'
	assert_absent "no inline style" "$body" ' style="'

	# --- the lists the API pages keep its paging, and no second one
	local path
	for path in queue suppression; do
		fetch "$adm/$path" "$good"
		body=$(cat "$work/b")
		assert_eq "GET $adm/$path" "$status" 200
		assert_absent "$path: no page controls of the browser's" "$body" 'data-slot="pagination"'
		assert_absent "$path: no Filters menu" "$body" 'Filters</button>'
		assert_contains "$path: the API's own next page link" "$body" "$adm/$path?"
	done

	# --- the delivery log pages what it was sent, and narrows with its own form
	fetch "$adm/deliveries" "$good"
	body=$(cat "$work/b")
	assert_eq "GET $adm/deliveries" "$status" 200
	# Five records fit one page: the range and the size, and no page controls.
	assert_contains "deliveries: the range of its one page" "$body" "1–5 of 5"
	assert_contains "deliveries: the page size" "$body" 'data-slot="native-select"'
	assert_absent "deliveries: no page controls for one page" "$body" 'data-slot="pagination"'
	assert_absent "deliveries: no Filters menu" "$body" 'Filters</button>'

	# --- the seed leaves with the reset
	reset_api
	fetch "$adm/accounts" "$good"
	assert_contains "after the reset the list is the 3 accounts again" "$(cat "$work/b")" "1–3 of 3"
}
