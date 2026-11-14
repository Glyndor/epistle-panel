# shellcheck shell=bash disable=SC2154,SC2034
# Scenario overview of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# count_in TEXT NEEDLE: how many times the fixed string NEEDLE is in TEXT.
count_in() {
	{ grep -o -F -- "$2" <<<"$1" || true; } | wc -l | tr -d ' '
}

# current_links: the links of the page's own content, in the last fetch, that
# say they are the current page. The sidebar marks its current entry and the
# trail its last step, both outside `main`: read with them, a check about the
# period's link would pass or fail on the navigation's.
current_links() {
	perl -0777 -ne 'print $1 if /(<main\b.*?<\/main>)/s' "$work/b" |
		{ grep -o -E '<a [^>]*aria-current="page"[^>]*>' || true; } | tr '\n' ' '
}

scenario_overview() {
	echo "# overview: the charts are drawn on the server from the API, with no inline style"
	fresh
	login admin correct-horse
	local good=$cookie body hostile before styled round

	reset_api
	set_404_reference
	assert_hidden "no cookie: GET the overview with a period" "$adm?since=7d"
	assert_eq "the denied call reached no endpoint" "$(api_count '"method"')" 0

	set_sample busy
	reset_log
	fetch "$adm" "$good"
	body=$(cat "$work/b")
	assert_eq "GET the overview with a session" "$status" 200
	assert_eq "four charts, each one image with a name and a description" "$(count_in "$body" 'role="img"')" 4
	assert_eq "each image is described by a sentence of the page" "$(count_in "$body" 'aria-describedby="overview-')" 4
	assert_contains "the marks are svg elements in the HTML, sized by attributes" "$body" '<svg data-slot="chart-mark" width="'
	assert_eq "no mark has a child: each is closed at once" \
		"$({ grep -o -E '<svg data-slot="chart-mark"[^>]*></svg>' "$work/b" || true; } | wc -l | tr -d ' ')" \
		"$(count_in "$body" '<svg data-slot="chart-mark"')"
	assert_eq "no inline style attribute or element" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	assert_contains "the outcomes card leads with the 67 records of 24 hours" "$body" '<span class="font-semibold text-2xl">67</span>'
	assert_contains "delivered: its count is in the table" "$body" 'data-cell="count">48<'
	assert_contains "delivered: its share is in the table" "$body" 'data-cell="share">71.6%<'
	assert_contains "failed: its count is in the table" "$body" 'data-cell="count">6<'
	assert_contains "the description says the numbers in words" "$body" '67 delivery records: 48 Delivered, 9 Deferred, 6 Failed, 3 Suppressed, and 1 Canceled.'
	assert_contains "an outcome links to the log filtered by it and the period" "$body" "href=\"$adm/deliveries?outcome=failed&amp;since=24h\""
	assert_contains "the bar has a part for the delivered records" "$body" 'data-part="delivered"'
	assert_contains "the queue card counts ten messages" "$body" '<span class="font-semibold text-2xl">10</span>'
	assert_contains "and their seventeen recipients" "$body" '17 recipients pending'
	assert_contains "the suppression card counts fourteen addresses" "$body" '<span class="font-semibold text-2xl">14</span>'
	assert_contains "and names the domain with the most" "$body" 'example.net'
	assert_contains "the current period is the link to the bare address" "$(current_links)" "href=\"$adm\""
	assert_eq "the two delivery cards read the log once between them" "$(api_count '"path":"/api/v1/deliveries?since=24h&limit=100"')" 1
	assert_eq "the queue is read once, a page of 100" "$(api_count '"path":"/api/v1/queue?limit=100"')" 1
	assert_eq "the suppression list is read once, a page of 100" "$(api_count '"path":"/api/v1/suppression?limit=100"')" 1
	assert_eq "the counters and the notice of the page read the status once between them" "$(api_count '"path":"/api/v1/status"')" 1
	assert_eq "every read answered: the page raises no warning" "$(count_in "$body" 'role="alert"')" 0
	assert_absent "and offers no retry" "$body" '>Retry</a>'
	assert_absent "the current period is a pill, with no line under it" "$(current_links)" 'underline'
	assert_contains "a column tells the pointer its total and its split by outcome" "$body" ' records ('

	fetch "$adm?since=7d" "$good"
	body=$(cat "$work/b")
	assert_eq "GET the overview of 7 days" "$status" 200
	assert_contains "7 days: 87 records" "$body" '<span class="font-semibold text-2xl">87</span>'
	assert_contains "7 days: 62 delivered" "$body" 'data-cell="count">62<'
	assert_contains "7 days: its link is the current one" "$(current_links)" "href=\"$adm?since=7d\""
	assert_eq "7 days: the period reached the API" "$(api_count '"path":"/api/v1/deliveries?since=7d&limit=100"')" 1
	assert_absent "7 days: a whole answer shades no column" "$body" 'data-shaded="true"'

	fetch "$adm?since=30d" "$good"
	body=$(cat "$work/b")
	assert_contains "30 days: the answer is full and the card says so" "$body" 'The server returned 100 records'
	assert_contains "30 days: it says the period may hold more, since the API does not tell" "$body" 'so this period may hold more'
	assert_absent "30 days: and never that it does" "$body" 'and this period holds more'
	assert_contains "30 days: the days the answer may not have reached are marked" "$body" 'data-shaded="true"'
	assert_contains "30 days: with a band of its own colour, not the muted surface" "$body" 'data-slot="chart-missing" class="flex-1 bg-chart-missing'
	assert_contains "30 days: and the legend names the band" "$body" 'May not have been returned'
	assert_contains "30 days: the day the answer stopped in says it may be a part" "$body" 'possibly in part'

	# Columns of very different totals. A column is as high as its total on the
	# scale and no more: the gaps and the minimum of a small part come out of
	# its larger parts. The axis ends on 60 and the plot is 160 px high.
	set_sample skew
	fetch "$adm" "$good"
	body=$(cat "$work/b")
	assert_contains "skew: the hour of 60 fills the plot" "$body" 'height="160"'
	assert_contains "skew: the hour of 12 is 32 px" "$body" 'height="32"'
	assert_contains "skew: the hour of 8 is 21.33 px" "$body" 'height="21.33"'
	assert_eq "skew: the hours of 5 and of 2 are 13.33 and 5.33 px, in parts of 2.67 px with no gap" "$(count_in "$body" 'height="2.67"')" 7
	assert_contains "skew: the hour of 5 names its five outcomes to the pointer" "$body" '5 records (1 Delivered, 1 Deferred, 1 Failed, 1 Suppressed, and 1 Canceled)'
	assert_absent "skew: a whole answer marks no column" "$body" 'data-shaded="true"'

	# Exactly what one answer holds, and exactly what the overview reads of the
	# queue and the list: nothing is missing, and only the log cannot say so.
	set_sample exact100
	fetch "$adm" "$good"
	body=$(cat "$work/b")
	assert_contains "exactly 100 records: the card says the period may hold more" "$body" 'so this period may hold more'
	assert_absent "exactly 100 records: no hour is said to be missing for certain" "$body" 'not returned by the server'
	assert_contains "a queue of exactly 500 is the whole queue" "$body" '500 recipients pending<'
	assert_absent "and is not called a part of one" "$body" 'oldest messages'
	assert_absent "a list of exactly 500 addresses is the whole list" "$body" 'first 500 addresses'

	# More of everything than is read.
	set_sample flood
	fetch "$adm" "$good"
	body=$(cat "$work/b")
	assert_contains "a longer queue: the recipients are those of the messages read" "$body" '500 recipients pending in the messages read'
	assert_contains "a longer queue: the description does not count them as the queue" "$body" 'The 500 oldest messages of a queue that holds more'
	assert_absent "a longer queue: nothing says 500 messages wait" "$body" '500 messages wait'
	assert_contains "a longer list: the note says the ranking is of the first 500 addresses" "$body" 'These are the first 500 addresses in alphabetical order. The list holds more, so this ranking of domains is of these 500 only.'
	assert_contains "a longer list: the description does not count them as the list" "$body" 'The first 500 suppressed addresses in alphabetical order, of a list that holds more'
	set_sample busy

	before=$(api_count '"path":"/api/v1/deliveries?since=24h&limit=100"')
	for hostile in "since=1e9d" "since=7d%0A" "since=..%2F7d" "since=%3Cscript%3E" "since=7D" "since=15m" "since=7d%26outcome%3Dfailed"; do
		fetch "$adm?$hostile" "$good"
		assert_eq "hostile period '${hostile:0:24}' still renders" "$status" 200
	done
	assert_eq "each one read the default period instead" "$(($(api_count '"path":"/api/v1/deliveries?since=24h&limit=100"') - before))" 7
	assert_eq "no hostile value reached the API" "$(($(api_count '1e9d') + $(api_count 'script') + $(api_count 'since=15m') + $(api_count 'since=7D')))" 0

	# React can cut a streamed page at any element. The holder it sends the
	# children of an svg in carries a style attribute, which the policy refuses;
	# with the API a little slow that showed in about half the answers of a
	# chart drawn with svg children. Twelve answers, none may carry one.
	set_delay 300
	styled=0
	for round in $(seq 1 12); do
		fetch "$adm" "$good"
		styled=$((styled + $({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')))
	done
	set_delay 0
	assert_eq "a slow API: no streamed part carries a style attribute, in 12 answers" "$styled" 0
	assert_contains "a slow API: the charts are in the answer all the same" "$(cat "$work/b")" 'data-part="delivered"'

	# The API fails every read. One warning for the page, at the top, with a
	# link that loads the same address again; no card repeats it.
	set_mode huge
	fetch "$adm?since=7d" "$good"
	body=$(cat "$work/b")
	assert_eq "API down: the page still renders" "$status" 200
	assert_eq "API down: one warning for the page" "$(count_in "$body" 'role="alert"')" 1
	assert_eq "API down: with a plain link to the address the reader is on" \
		"$({ grep -o -E "<a [^>]*href=\"$adm\?since=7d\"[^>]*>Retry</a>" "$work/b" || true; } | wc -l | tr -d ' ')" 1
	assert_eq "API down: each of the four cards says it was not loaded" "$(count_in "$body" '>Not loaded<')" 4
	assert_absent "API down: no card draws a chart" "$body" 'role="img"'
	assert_eq "API down: no inline style either" \
		"$({ grep -o -E ' style="|<style' "$work/b" || true; } | wc -l | tr -d ' ')" 0
	set_mode ok
	fetch "$adm?since=7d" "$good"
	assert_eq "the API back: the warning is gone" "$(count_in "$(cat "$work/b")" 'role="alert"')" 0

	set_sample log-off
	fetch "$adm" "$good"
	body=$(cat "$work/b")
	assert_contains "log off: the delivery cards say so" "$body" 'The delivery log is off'
	assert_absent "log off: and draw no bar" "$body" 'data-slot="segmented-bar"'
	assert_eq "log off: it is not shown as an unreachable API, no card raises an alert" "$(count_in "$body" 'role="alert"')" 0
	assert_contains "an empty queue says so" "$body" 'The queue is empty'
	assert_contains "an empty suppression list says so" "$body" 'No address is suppressed'

	set_sample quiet
	fetch "$adm" "$good"
	assert_contains "no record in the period: the card says so" "$(cat "$work/b")" 'No delivery in this period'

	assert_eq "the overview only reads: no DELETE reached the API" "$(api_count '"method":"DELETE"')" 0
	assert_eq "nothing but GET since the sign-in" "$(($(api_count '"method"') - $(api_count '"method":"GET"')))" 0
	assert_eq "every call carried the valid bearer" "$(api_count '"bearer":"valid"')" "$(api_count '"method"')"
}
