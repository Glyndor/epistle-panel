#!/usr/bin/env bash
# Tests of scripts/ci/pins/check.sh in throwaway repositories. A commit-pinned
# action of actions/ or github/, a local one, an allowed third party and an image
# with a digest pass. A tag, a short SHA, a branch, a missing @, a 39 and a 41 digit
# SHA, a third party that is not allowed (a pinned one too), an image without a
# digest, a `uses:` the reader cannot take apart and an empty tree each fail, in a
# workflow and in an action, with either suffix.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
sha=$(printf 'a%.0s' $(seq 1 40))
dig=$(printf 'b%.0s' $(seq 1 64))

fail=0
# case <pass|fail> <name> <path> <the uses: line>
case_() {
	local expected="$1" name="$2" path="$3" line="$4" status=0
	rm -rf "$work/r"
	git init -q -b main "$work/r"
	mkdir -p "$work/r/$(dirname "$path")"
	# A valid workflow beside it, so that a file the check does not see is not
	# mistaken for a failure of the check on an empty tree.
	mkdir -p "$work/r/.github/workflows"
	printf 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@%s\n' "$sha" >"$work/r/.github/workflows/ok.yml"
	printf 'jobs:\n  a:\n    steps:\n%s\n' "$line" >"$work/r/$path"
	git -C "$work/r" add -A
	(cd "$work/r" && bash "$check" >/dev/null 2>&1) || status=$?
	if { [ "$expected" = pass ] && [ "$status" -eq 0 ]; } || { [ "$expected" = fail ] && [ "$status" -ne 0 ]; }; then
		echo "ok   $name"
	else
		echo "FAIL $name (exit $status)"
		fail=1
	fi
}
wf=.github/workflows/x.yml

case_ pass "actions pinned to a commit, with a version comment" $wf "      - uses: actions/checkout@$sha # v7.0.1"
case_ pass "github pinned to a commit, with a path" $wf "      - uses: github/codeql-action/init@$sha"
case_ pass "a local workflow" $wf "    uses: ./.github/workflows/ci-e2e.yml"
case_ pass "an image with a digest" $wf "      - uses: docker://alpine@sha256:$dig"
case_ pass "the allowed third party, pinned" $wf "      - uses: oven-sh/setup-bun@$sha"
case_ fail "a tag: actions/checkout@v7" $wf "      - uses: actions/checkout@v7"
case_ fail "a tag with a patch: actions/checkout@v7.0.1" $wf "      - uses: actions/checkout@v7.0.1"
case_ fail "a branch" $wf "      - uses: actions/checkout@main"
case_ fail "a short SHA" $wf "      - uses: actions/checkout@3d3c42e"
case_ fail "a 39 digit SHA" $wf "      - uses: actions/checkout@${sha:1}"
case_ fail "a 41 digit SHA" $wf "      - uses: actions/checkout@${sha}a"
case_ fail "no @ at all" $wf "      - uses: actions/checkout"
case_ fail "a third party that is not allowed, pinned" $wf "      - uses: someone/tool@$sha"
case_ fail "a reusable workflow of the organisation" $wf "    uses: Glyndor/.github/.github/workflows/dco.yml@$sha"
case_ fail "a third party that only starts like an allowed one" $wf "      - uses: oven-sh/setup-bunny@$sha"
case_ fail "an image without a digest" $wf "      - uses: docker://alpine:3"
case_ fail "an image with a tag and a short digest" $wf "      - uses: docker://alpine@sha256:abc"
case_ fail "a uses: inside a flow mapping, which the reader cannot take apart" $wf "      - { uses: actions/checkout@v7 }"
case_ fail "a uses: with two words" $wf "      - uses: actions/checkout@$sha extra"
case_ fail "the same tag in a .yaml workflow" .github/workflows/x.yaml "      - uses: actions/checkout@v7"
case_ fail "the same tag in a nested workflow folder" .github/workflows/sub/x.yml "      - uses: actions/checkout@v7"
case_ fail "the same tag in an action.yml elsewhere in the tree" tools/y/action.yml "      - uses: actions/checkout@v7"
case_ fail "the same tag in an action.yaml" .github/actions/z/action.yaml "      - uses: actions/checkout@v7"
case_ pass "a commented-out tag is not read" $wf "      # - uses: actions/checkout@v7"

# A tree with no workflow or action reads nothing, and says so.
rm -rf "$work/r"
git init -q -b main "$work/r"
echo hi >"$work/r/README"
git -C "$work/r" add -A
if (cd "$work/r" && bash "$check" >/dev/null 2>&1); then
	echo "FAIL a tree with no workflow passes"
	fail=1
else
	echo "ok   a tree with no workflow is a failure, not a pass"
fi

# The repository's own tree passes.
if (cd "$here" && bash "$check" >/dev/null 2>&1); then
	echo "ok   this repository passes"
else
	echo "FAIL this repository fails its own check"
	fail=1
fi

exit "$fail"
