#!/usr/bin/env bash
# Cancel the other runs of a pull request commit.
#
# When a cheap check fails, what else runs for the same commit answers a
# question about a change that will be pushed again: CodeQL, the sign-off check,
# the folder limit. This asks for those runs and cancels them, except the run it
# belongs to, whose `ci gate` must still report the failure.
#
#   GH_TOKEN=... REPO=... SHA=<head> BRANCH=<head branch> SELF=<run id> others.sh
#
# What it may cancel is narrow on purpose, because the token that runs it can
# write to Actions:
#   - runs of the `pull_request` event, of the same head branch and the same
#     commit, never its own run;
#   - of the workflows in CANCELLABLE below. A run of `push`, `merge_group`,
#     `schedule` or `workflow_dispatch`, and anything that releases or
#     publishes, is never on the list, whatever commit it shares.
#
# Best effort: the token of a pull request opened by Dependabot cannot cancel, and
# a run that finished a second ago cannot be cancelled either. Neither is an
# error, because the failure that called this is already reported.
set -euo pipefail

: "${REPO:?REPO is not set}"
: "${SHA:?SHA is not set}"
: "${BRANCH:?BRANCH is not set}"
: "${SELF:?SELF is not set}"

# The names of the workflows (the `name:` of each file) that this may cancel.
CANCELLABLE=("CodeQL" "DCO" "Folder limit" "Dependency audit")

listing="$(gh run list --repo "$REPO" --event pull_request --branch "$BRANCH" --commit "$SHA" --limit 100 \
	--json databaseId,status,workflowName,event,headBranch,headSha)" || {
	echo "::notice::could not list the runs of $SHA; nothing was cancelled"
	exit 0
}

allowed="$(printf '%s\n' "${CANCELLABLE[@]}" | jq -R . | jq -s .)"
ids="$(printf '%s' "$listing" | jq -r --arg sha "$SHA" --arg branch "$BRANCH" --arg self "$SELF" --argjson allowed "$allowed" '
	.[]
	| select(.event == "pull_request" and .headSha == $sha and .headBranch == $branch)
	| select(.status == "in_progress" or .status == "queued" or .status == "waiting" or .status == "pending")
	| select(.workflowName as $w | $allowed | index($w))
	| select((.databaseId | tostring) != $self)
	| .databaseId')" || {
	echo "::notice::could not read the list of runs; nothing was cancelled"
	exit 0
}

cancelled=0
for id in $ids; do
	if gh run cancel "$id" --repo "$REPO" >/dev/null 2>&1; then
		echo "cancelled run $id"
		cancelled=$((cancelled + 1))
	else
		echo "::notice::could not cancel run $id"
	fi
done
echo "cancelled $cancelled other run(s) of $SHA"
