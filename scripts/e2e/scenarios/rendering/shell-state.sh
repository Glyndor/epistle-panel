# shellcheck shell=bash disable=SC2154,SC2034
# Scenario shell-state of scripts/e2e/run.sh.
# Sourced by the runner, which provides the helpers in scripts/e2e/lib.

# group_heading: the aria-expanded value of the first group heading of the
# sidebar in the last page, or nothing when the page has none.
group_heading() {
	{ grep -o '<button[^>]*data-slot="sidebar-group-label"[^>]*>' "$work/b" || true; } | head -1 |
		{ grep -o 'aria-expanded="[^"]*"' || true; }
}

# quota_level: the data-level of the storage box in the last page, or nothing.
quota_level() {
	{ grep -o '<section[^>]*data-slot="quota"[^>]*>' "$work/b" || true; } | head -1 |
		{ grep -o 'data-level="[^"]*"' || true; }
}

scenario_shell_state() {
	echo "# the shell's saved states: a closed group is served closed, and the storage holds its place whatever the mail server answers"
	fresh
	login admin correct-horse
	local good=$cookie value

	# --- a group of the navigation, from its cookie
	fetch "$adm/queue" "$good"
	assert_eq "no groups cookie: the page answers" "$status" 200
	assert_eq "no groups cookie: the group is served open" "$(group_heading)" 'aria-expanded="true"'
	assert_contains "no groups cookie: every entry is in the page" "$(cat "$work/b")" "href=\"$adm/domains\""

	fetch "$adm/queue" "$good; sidebar_groups=manage"
	assert_eq "the group named in the cookie is served closed" "$(group_heading)" 'aria-expanded="false"'
	assert_contains "closed, the entry of the current page is still in the page" "$(cat "$work/b")" "href=\"$adm/queue\""
	assert_absent "closed, no other entry of the group is" "$(cat "$work/b")" "href=\"$adm/domains\""
	assert_absent "closed, the page has no style attribute" "$(cat "$work/b")" ' style='

	fetch "$adm/queue" "$good; sidebar_groups=manage.folders"
	assert_eq "both groups named: the administration's is served closed" "$(group_heading)" 'aria-expanded="false"'

	# Anyone can write a cookie: a name that is no group, more names than
	# there are groups, markup. Each is read as no cookie, and none of it is
	# in the page.
	#
	# Each value is looked for with a piece of it that the page cannot hold
	# by chance: a piece of two letters is the hash of a chunk of the build.
	local pair value needle
	for pair in \
		'zzgroupzz|zzgroupzz' \
		'manage.zzgroupzz|zzgroupzz' \
		'MANAGE|MANAGE' \
		'manage.folders.labels.manage|labels.manage' \
		'manage"><i/data-zz=1>|data-zz=1' \
		'<script>zz</script>|script>zz'; do
		value=${pair%%|*}
		needle=${pair#*|}
		fetch "$adm/queue" "$good; sidebar_groups=$value"
		assert_eq "groups cookie '$value': the page answers" "$status" 200
		assert_eq "groups cookie '$value': the group is served open" "$(group_heading)" 'aria-expanded="true"'
		assert_absent "groups cookie '$value': nothing of it is in the page" "$(cat "$work/b")" "$needle"
	done

	fetch "/app/mail/sent" "$good; sidebar_groups=folders"
	assert_eq "the folders named in the cookie: the page answers" "$status" 200
	assert_contains "the folders' placeholder is sent closed" "$(cat "$work/b")" 'data-slot="folder-skeleton" data-state="closed"'
	assert_eq "and the folders come closed" "$(group_heading)" 'aria-expanded="false"'
	fetch "/app/mail/sent" "$good"
	assert_contains "no cookie: the folders' placeholder is sent open" "$(cat "$work/b")" 'data-slot="folder-skeleton" data-state="open"'

	# --- the storage at the foot of the mail's sidebar: a box in every case
	for value in limited unlimited none; do
		reset_api
		set_quota "$value"
		# The place is sent only when the quota is not there yet at the first
		# flush: a stand-in that answers at once makes this check a race.
		set_delay 300
		fetch "/app/mail" "$good"
		assert_eq "quota $value: the page answers" "$status" 200
		assert_contains "quota $value: the frame holds the storage's place" "$(cat "$work/b")" 'data-slot="quota-placeholder"'
		case "$value" in
		limited) assert_eq "quota limited: the box is a meter" "$(quota_level)" 'data-level="ok"' ;;
		unlimited) assert_eq "quota unlimited: the box says what is used, with no meter" "$(quota_level)" 'data-level="unlimited"' ;;
		none) assert_eq "quota none: the box says the usage is not available" "$(quota_level)" 'data-level="unknown"' ;;
		esac
	done
	reset_api
	set_mode huge
	fetch "/app/mail" "$good"
	set_mode ok
	assert_eq "mail server failing: the page answers" "$status" 200
	assert_eq "mail server failing: the box is there and says the usage is not available" "$(quota_level)" 'data-level="unknown"'
	reset_api
}
