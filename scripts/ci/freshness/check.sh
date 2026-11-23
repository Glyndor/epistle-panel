#!/usr/bin/env bash
# Fail when Dependabot has not opened a pull request here for too long.
#
# A silent Dependabot reports nothing, and "everything is up to date" looks the
# same. The newest pull request authored by `dependabot[bot]`, in any state, is
# taken as the last time it spoke, and the check fails when that is older than
# the limit. Dependabot only opens a pull request when something upstream moved,
# so the limit has to be well above one missed weekly run.
#
#   GH_TOKEN=... REPO=Glyndor/epistle-panel MAX_AGE_DAYS=15 scripts/ci/freshness/check.sh
#
# The window is paged: a page of 20 is a window on all the pull request
# activity, not on Dependabot's, and in a busy repository the bot's newest pull
# request falls off the end. Three pages of 100 are read, and the loop stops at
# the first page that holds a hit.
set -euo pipefail

: "${REPO:?REPO is not set}"
: "${MAX_AGE_DAYS:?MAX_AGE_DAYS is not set}"
case "$MAX_AGE_DAYS" in
'' | *[!0-9]*)
	echo "::error::MAX_AGE_DAYS must be a whole number (got '$MAX_AGE_DAYS')"
	exit 2
	;;
esac

latest=""
pages_read=0
for page in 1 2 3; do
	pages_read="$page"
	latest="$(gh api "repos/${REPO}/pulls?state=all&per_page=100&page=${page}" \
		--jq '[.[] | select(.user.login == "dependabot[bot]")] | sort_by(.created_at) | reverse | .[0].created_at // empty')"
	[ -n "$latest" ] && break
done

if [ -z "$latest" ]; then
	echo "::error::No Dependabot pull request in the newest $((pages_read * 100)) of ${REPO}."
	echo "Either it has never run here or its schedule was dropped. Check that dependabot.yml is on the default branch, then disable and enable Dependabot to register it again." >&2
	exit 1
fi

age_days=$((($(date -u +%s) - $(date -u -d "$latest" +%s)) / 86400))
echo "Newest Dependabot pull request in ${REPO}: ${latest} (${age_days} days ago)."

if [ "$age_days" -gt "$MAX_AGE_DAYS" ]; then
	echo "::error::Dependabot last opened a pull request ${age_days} days ago in ${REPO}, over the ${MAX_AGE_DAYS}-day limit."
	echo "Check dependabot.yml on the default branch and the package ecosystems it lists." >&2
	exit 1
fi
echo "Within the ${MAX_AGE_DAYS}-day limit."
