#!/usr/bin/env bash
# The sign-off gate: every commit of a pull request carries a `Signed-off-by`
# trailer, and no merge commit of it hides a change that exists in neither of
# its parents.
#
#   BASE_SHA=<base> HEAD_SHA=<head> scripts/ci/dco/check.sh
#
# BASE_SHA and HEAD_SHA are the real base and head commits of the pull request
# (`github.event.pull_request.base.sha` and `.head.sha`), not the synthetic
# merge commit `actions/checkout` builds. That commit is never in the range
# BASE_SHA..HEAD_SHA, so `--no-merges` below only skips real merge commits on
# the branch itself; those are judged by the second check.
set -euo pipefail

: "${BASE_SHA:?BASE_SHA is not set}"
: "${HEAD_SHA:?HEAD_SHA is not set}"

missing=0
commits="$(git rev-list --no-merges "${BASE_SHA}..${HEAD_SHA}")" || {
	echo "::error::could not list the commits between ${BASE_SHA} and ${HEAD_SHA}; this check fails closed"
	exit 1
}
for sha in $commits; do
	author="$(git show -s --format='%an <%ae>' "$sha")"
	if ! git show -s --format='%(trailers:key=Signed-off-by)' "$sha" | grep -qi 'Signed-off-by:'; then
		echo "::error::commit $sha ($author) is missing a Signed-off-by trailer"
		missing=1
	fi
done
if [ "$missing" -ne 0 ]; then
	echo "Add a sign-off with: git commit -s (or git rebase --signoff)."
	exit 1
fi
echo "All commits carry a Signed-off-by trailer."

# A merge commit's tree has to equal the clean merge of its two parents. If it
# does not, the merge was edited by hand to carry a change that neither parent
# has, which never went through review or sign-off on a commit of its own.
# Octopus merges and merges whose parents conflict cannot be recomputed, so they
# fail closed instead of being assumed safe. The flow is squash-only, so a merge
# commit inside a pull request is avoidable: rebase onto the base instead.
bad=0
merges="$(git rev-list --merges "${BASE_SHA}..${HEAD_SHA}")" || {
	echo "::error::could not list the merge commits between ${BASE_SHA} and ${HEAD_SHA}; this check fails closed"
	exit 1
}
stderr_file="$(mktemp)"
trap 'rm -f "$stderr_file"' EXIT
for m in $merges; do
	read -r -a parents <<<"$(git show -s --format='%P' "$m")"
	if [ "${#parents[@]}" -ne 2 ]; then
		echo "::error::merge commit $m has ${#parents[@]} parents; only an ordinary two-parent merge can be verified"
		bad=1
		continue
	fi
	actual_tree="$(git rev-parse "${m}^{tree}")"
	if ! clean_tree="$(git merge-tree --write-tree "${parents[0]}" "${parents[1]}" 2>"$stderr_file")"; then
		echo "::error::merge commit $m cannot be verified (conflicted, or merge-tree failed); rebase the branch onto its base or re-merge without conflicts"
		cat "$stderr_file"
		bad=1
		continue
	fi
	if [ "$clean_tree" != "$actual_tree" ]; then
		echo "::error::merge commit $m has a tree that differs from the clean merge of ${parents[0]} and ${parents[1]}"
		bad=1
	fi
done
if [ "$bad" -ne 0 ]; then
	echo "A merge commit carries unreviewed changes or could not be verified."
	exit 1
fi
echo "No evil merges found."
