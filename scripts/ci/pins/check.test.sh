#!/usr/bin/env bash
# Tests of scripts/ci/pins/check.sh in throwaway repositories.
#
# What the files say: a commit-pinned action of actions/ or github/ with the
# version of its release in a comment, a local one and an image of the list with a
# digest pass. A tag, a short or long SHA, a branch, a missing @, a missing or odd
# version comment, a third party (a pinned one too), an image without a digest, an
# image of a repository that is not on the list in a `uses:` or anywhere else, two
# commits or two releases for one action in the tree, a `uses:` the reader cannot
# take apart and an empty tree each fail, in a workflow and in an action, with
# either suffix.
#
# What the repositories say (--remote): the commit has to be the one the tag of the
# comment points to, the peeled one for an annotated tag. A different commit, a tag
# that is not there and a repository that cannot be asked each fail. The network is
# a stand-in `git` that answers `ls-remote` from a file.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
check="$here/check.sh"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
sha=$(printf 'a%.0s' $(seq 1 40))
sha2=$(printf 'c%.0s' $(seq 1 40))
dig=$(printf 'b%.0s' $(seq 1 64))
real_git="$(command -v git)"
mkdir "$work/bin"
cat >"$work/bin/git" <<STUB
#!/usr/bin/env bash
if [ "\${1:-}" = ls-remote ]; then
	echo "\$*" >>"\$LS_REMOTE_LOG"
	[ -f "\$LS_REMOTE_FAIL" ] && { echo "fatal: unable to access" >&2; exit 128; }
	cat "\$LS_REMOTE_OUT"
	exit 0
fi
exec "$real_git" "\$@"
STUB
chmod +x "$work/bin/git"
export LS_REMOTE_LOG="$work/ls-remote.log" LS_REMOTE_OUT="$work/ls-remote.out" LS_REMOTE_FAIL="$work/ls-remote.fail"

fail=0
verdict() { # expected name status
	if { [ "$1" = pass ] && [ "$3" -eq 0 ]; } || { [ "$1" = fail ] && [ "$3" -ne 0 ]; }; then
		echo "ok   $2"
	else
		echo "FAIL $2 (exit $3)"
		fail=1
	fi
}
fresh() {
	rm -rf "$work/r"
	git init -q -b main "$work/r"
	mkdir -p "$work/r/.github/workflows"
	# A valid workflow beside the one under test, so that a file the check does not
	# see is not mistaken for a failure of the check on an empty tree.
	printf 'jobs:\n  a:\n    steps:\n      - uses: actions/checkout@%s # v7.0.1\n' "$sha" >"$work/r/.github/workflows/ok.yml"
}
run_check() { (cd "$work/r" && git add -A && bash "$check" "$@" >"$work/out" 2>&1) && return 0 || return 1; }
# case_ <pass|fail> <name> <path> <the uses: line>
case_() {
	local status=0
	fresh
	mkdir -p "$work/r/$(dirname "$3")"
	printf 'jobs:\n  a:\n    steps:\n%s\n' "$4" >"$work/r/$3"
	run_check || status=$?
	verdict "$1" "$2" "$status"
}
# files_ <pass|fail> <name> <file>:<content>... ; offline
wf=.github/workflows/x.yml
a_ok="      - uses: actions/checkout@$sha # v7.0.1"

case_ pass "actions pinned to a commit, with the version of its release" $wf "$a_ok"
case_ pass "github pinned to a commit, with a path" $wf "      - uses: github/codeql-action/init@$sha # v4.39.4"
case_ pass "a local workflow" $wf "    uses: ./.github/workflows/ci-e2e.yml"
case_ pass "an image of the list with a digest" $wf "      - uses: docker://docker.io/library/debian@sha256:$dig"
case_ fail "a tag: actions/checkout@v7" $wf "      - uses: actions/checkout@v7"
case_ fail "a tag with a patch: actions/checkout@v7.0.1" $wf "      - uses: actions/checkout@v7.0.1"
case_ fail "a branch" $wf "      - uses: actions/checkout@main"
case_ fail "a short SHA" $wf "      - uses: actions/checkout@3d3c42e # v7.0.1"
case_ fail "a 39 digit SHA" $wf "      - uses: actions/checkout@${sha:1} # v7.0.1"
case_ fail "a 41 digit SHA" $wf "      - uses: actions/checkout@${sha}a # v7.0.1"
case_ fail "no @ at all" $wf "      - uses: actions/checkout"
case_ fail "a commit with no version comment" $wf "      - uses: actions/upload-artifact@$sha"
case_ fail "a commit with an empty comment" $wf "      - uses: actions/upload-artifact@$sha #"
case_ fail "a commit with a comment that is not a version" $wf "      - uses: actions/upload-artifact@$sha # the latest"
case_ fail "a commit with a version that is not of the form v1.2.3" $wf "      - uses: actions/upload-artifact@$sha # 7.0.1"
case_ fail "a third party, pinned and with a version" $wf "      - uses: someone/tool@$sha # v1.0.0"
case_ fail "a reusable workflow of the organisation" $wf "    uses: Glyndor/.github/.github/workflows/dco.yml@$sha # v1.21.0"
case_ fail "an image without a digest" $wf "      - uses: docker://alpine:3"
case_ fail "an image with a short digest" $wf "      - uses: docker://docker.io/library/debian@sha256:abc"
case_ fail "an image of a repository that is not on the list" $wf "      - uses: docker://alpine@sha256:$dig"
case_ fail "a uses: inside a flow mapping, which the reader cannot take apart" $wf "      - { uses: actions/checkout@v7 }"
case_ fail "a uses: with two words" $wf "      - uses: actions/checkout@$sha extra # v7.0.1"
case_ fail "the same tag in a .yaml workflow" .github/workflows/x.yaml "      - uses: actions/checkout@v7"
case_ fail "the same tag in a nested workflow folder" .github/workflows/sub/x.yml "      - uses: actions/checkout@v7"
case_ fail "the same tag in an action.yml elsewhere in the tree" tools/y/action.yml "      - uses: actions/checkout@v7"
case_ fail "the same tag in an action.yaml" .github/actions/z/action.yaml "      - uses: actions/checkout@v7"
case_ pass "a commented-out tag is not read" $wf "      # - uses: actions/checkout@v7"

# An image fixed by digest anywhere in a workflow is of a repository on the list.
case_ pass "an image of the list in an env" $wf "      - run: echo 1
        env:
          IMAGE: docker.io/library/debian:trixie@sha256:$dig"
case_ pass "a registry of the list in an env, with no tag" $wf "      - run: echo 1
        env:
          REGISTRY: docker.io/library/registry@sha256:$dig"
case_ fail "an image of another repository in an env" $wf "      - run: echo 1
        env:
          IMAGE: docker.io/library/ubuntu:24.04@sha256:$dig"
case_ fail "an image of another registry with the same name" $wf "      - run: echo 1
        env:
          IMAGE: evil.example/library/debian:trixie@sha256:$dig"
case_ fail "an image of another repository in a run line" $wf "      - run: podman run alpine@sha256:$dig true"

# One commit and one release for each action in the whole tree.
two() { # <pass|fail> <name> <line in x.yml> <line in y.yml>
	local status=0
	fresh
	printf 'jobs:\n  a:\n    steps:\n%s\n' "$3" >"$work/r/.github/workflows/x.yml"
	printf 'jobs:\n  a:\n    steps:\n%s\n' "$4" >"$work/r/.github/workflows/y.yml"
	run_check || status=$?
	verdict "$1" "$2" "$status"
}
two pass "the same commit and release in two workflows" "$a_ok" "$a_ok"
two fail "two commits of one action in two workflows" "$a_ok" "      - uses: actions/checkout@$sha2 # v7.0.1"
two fail "two releases for one commit in two workflows" "$a_ok" "      - uses: actions/checkout@$sha # v7.0.2"
two pass "two actions with their own pairs" "$a_ok" "      - uses: actions/upload-artifact@$sha2 # v7.0.2"
two pass "two paths of one repository, one pair" "      - uses: github/codeql-action/init@$sha # v4.39.4" "      - uses: github/codeql-action/analyze@$sha # v4.39.4"
two fail "two paths of one repository, two pairs" "      - uses: github/codeql-action/init@$sha # v4.39.4" "      - uses: github/codeql-action/analyze@$sha2 # v4.39.4"

# A tree with no workflow or action reads nothing, and says so.
rm -rf "$work/r"
git init -q -b main "$work/r"
echo hi >"$work/r/README"
git -C "$work/r" add -A
status=0
(cd "$work/r" && bash "$check" >/dev/null 2>&1) || status=$?
verdict fail "a tree with no workflow is a failure, not a pass" "$status"

# --remote: the tag has to be the commit.
remote() { # <pass|fail> <name> ; the answer is in $LS_REMOTE_OUT
	local status=0
	fresh
	run_check --remote || status=$?
	verdict "$1" "$2" "$status"
}
export PATH="$work/bin:$PATH"
rm -f "$LS_REMOTE_FAIL"
: >"$LS_REMOTE_LOG"
printf '%s\trefs/tags/v7.0.1\n' "$sha" >"$LS_REMOTE_OUT"
remote pass "the tag of the comment points to the commit"
if grep -q "ls-remote https://github.com/actions/checkout refs/tags/v7.0.1 refs/tags/v7.0.1^{}" "$LS_REMOTE_LOG"; then
	echo "ok   it asked the repository of the action for the tag and the peeled tag"
else
	echo "FAIL it did not ask the repository for the tag"
	fail=1
fi
printf '%s\trefs/tags/v7.0.1\n' "$sha2" >"$LS_REMOTE_OUT"
remote fail "the tag points to another commit"
printf '%s\trefs/tags/v7.0.1\n%s\trefs/tags/v7.0.1^{}\n' "$sha2" "$sha" >"$LS_REMOTE_OUT"
remote pass "an annotated tag: the peeled commit is the one"
printf '%s\trefs/tags/v7.0.1\n%s\trefs/tags/v7.0.1^{}\n' "$sha" "$sha2" >"$LS_REMOTE_OUT"
remote fail "an annotated tag: the object of the tag is not the commit, the peeled one is what counts"
: >"$LS_REMOTE_OUT"
remote fail "the tag is not there"
printf '%s\trefs/tags/v7.0.10\n' "$sha" >"$LS_REMOTE_OUT"
remote fail "another tag with the same start does not stand for it"
printf '%s\trefs/tags/v7.0.1\n' "$sha" >"$LS_REMOTE_OUT"
touch "$LS_REMOTE_FAIL"
remote fail "a repository that cannot be asked is not approved"
rm -f "$LS_REMOTE_FAIL"
# Without --remote the network is not used.
: >"$LS_REMOTE_LOG"
status=0
fresh
run_check || status=$?
verdict pass "offline, nothing is asked" "$status"
if [ -s "$LS_REMOTE_LOG" ]; then
	echo "FAIL the offline run asked a repository"
	fail=1
fi
status=0
(cd "$work/r" && bash "$check" --other >/dev/null 2>&1) || status=$?
verdict fail "an unknown option is refused" "$status"

# The repository's own tree passes what the files say.
if (cd "$here" && PATH="${PATH//$work\/bin:/}" bash "$check" >/dev/null 2>&1); then
	echo "ok   this repository passes"
else
	echo "FAIL this repository fails its own check"
	fail=1
fi

exit "$fail"
