#!/usr/bin/env bash
# Every `uses:` of a workflow or an action of this repository is fixed to a
# commit that is the release it says, and nothing runs that is not from
# `actions/` or `github/`.
#
#   scripts/ci/pins/check.sh            what the files say
#   scripts/ci/pins/check.sh --remote   and ask each repository whether it is true
#
# A reference passes when it is
#   - local (`./...`), or
#   - `actions/<name>[/<path>]@<40 hex digits> # vX.Y.Z` or the same with `github/`,
#     with the version of the release the commit belongs to written in the comment, or
#   - `docker://<image>@sha256:<64 hex digits>` of an image in IMAGE_REPOS, or
#   - one of the third-party references in ALLOWED_THIRD_PARTY, which is empty.
# A tag, a short SHA, a branch, a missing `@`, a missing or odd version comment, an
# owner that is not on the list and an image without a digest each fail, and so does
# a `uses:` the reader cannot take apart (written inside a flow mapping, for
# instance): a line this script does not consume is a line it cannot judge.
#
# Across the whole tree an action has ONE pair of commit and version: two workflows
# that disagree fail, so the action of a job with privileges cannot move alone.
# Every image fixed by digest anywhere in a workflow, `uses:` or not, is in
# IMAGE_REPOS.
#
# With --remote, each (repository, version, commit) is asked of the repository:
#   git ls-remote https://github.com/<owner>/<repo> refs/tags/<version> refs/tags/<version>^{}
# and the commit has to be exactly the one the tag points to (the peeled one when the
# tag is annotated). A repository that cannot be asked, or a tag that is not there,
# fails: a check that cannot look does not approve. The network is used only here;
# the tests give it a stand-in `git`.
#
# It reads every tracked workflow and action: `.github/**/*.yml` and `.yaml`, and
# `action.yml` or `action.yaml` anywhere in the tree.
set -euo pipefail
export LC_ALL=C

remote=0
case "${1:-}" in
'') ;;
--remote) remote=1 ;;
*)
	echo "usage: $0 [--remote]" >&2
	exit 2
	;;
esac

# Third-party references that are allowed, by exact owner/name. There are none.
ALLOWED_THIRD_PARTY=()
# The repositories of the images that may be fixed by digest.
IMAGE_REPOS=("docker.io/library/debian" "docker.io/library/registry")

cd "$(git rev-parse --show-toplevel)"

fail=0
checked=0
files=0
declare -A pair_of=() pair_file=() asked=()
declare -a to_ask=()

image_allowed() { # an image reference with its digest
	local repo="${1%@*}" last ok
	repo="${repo#docker://}"
	last="${repo##*/}"
	# A tag is a colon in the last part of the name; `host:port/name` has it earlier.
	[[ "$last" == *:* ]] && repo="${repo%:*}"
	for ok in "${IMAGE_REPOS[@]}"; do
		[ "$repo" = "$ok" ] && return 0
	done
	return 1
}

while IFS= read -r -d '' file; do
	[ -f "$file" ] || continue
	files=$((files + 1))
	lineno=0
	while IFS= read -r line || [ -n "$line" ]; do
		lineno=$((lineno + 1))
		# Every image fixed by digest, wherever it is written.
		rest="$line"
		while [[ "$rest" =~ ([A-Za-z0-9._/:-]+@sha256:[0-9a-f]{64})(.*) ]]; do
			if ! image_allowed "${BASH_REMATCH[1]}"; then
				echo "::error file=$file,line=$lineno::the image ${BASH_REMATCH[1]%@*} is not in the list of images this repository fixes by digest"
				fail=1
			fi
			rest="${BASH_REMATCH[2]}"
		done
		case "$line" in *uses:*) ;; *) continue ;; esac
		# What is before the comment is the reference; what follows is the version.
		stripped="${line%%#*}"
		comment=""
		case "$line" in *\#*) comment="${line#*#}" ;; esac
		case "$stripped" in *uses:*) ;; *) continue ;; esac
		if [[ ! "$stripped" =~ ^[[:space:]]*(-[[:space:]]+)?uses:[[:space:]]+([^[:space:]]+)[[:space:]]*$ ]]; then
			echo "::error file=$file,line=$lineno::cannot read this uses: line, so it is not judged"
			fail=1
			continue
		fi
		ref="${BASH_REMATCH[2]}"
		ref="${ref%\"}"
		ref="${ref#\"}"
		ref="${ref%\'}"
		ref="${ref#\'}"
		checked=$((checked + 1))
		case "$ref" in
		./*) continue ;;
		docker://*)
			if [[ ! "$ref" =~ ^docker://[^@[:space:]]+@sha256:[0-9a-f]{64}$ ]]; then
				echo "::error file=$file,line=$lineno::$ref is an image without a sha256 digest"
				fail=1
			fi
			continue
			;;
		esac
		if [[ ! "$ref" =~ ^([A-Za-z0-9._-]+)/([A-Za-z0-9._-]+)(/[A-Za-z0-9._/-]+)?@(.+)$ ]]; then
			echo "::error file=$file,line=$lineno::$ref has no @<commit>"
			fail=1
			continue
		fi
		owner="${BASH_REMATCH[1]}"
		name="${BASH_REMATCH[2]}"
		version="${BASH_REMATCH[4]}"
		if [[ ! "$version" =~ ^[0-9a-f]{40}$ ]]; then
			echo "::error file=$file,line=$lineno::$ref is fixed to '$version', not to a 40 digit commit"
			fail=1
			continue
		fi
		commit="$version"
		case "$owner" in
		actions | github) ;;
		*)
			allowed=0
			for ok in ${ALLOWED_THIRD_PARTY[@]+"${ALLOWED_THIRD_PARTY[@]}"}; do
				[ "$owner/$name" != "$ok" ] || allowed=1
			done
			if [ "$allowed" -ne 1 ]; then
				echo "::error file=$file,line=$lineno::$owner/$name is not from actions/ or github/"
				fail=1
				continue
			fi
			;;
		esac
		# The release the commit belongs to, in the comment: `# v7.0.1`.
		release="$(printf '%s' "$comment" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
		if [[ ! "$release" =~ ^v[0-9]+(\.[0-9]+){0,2}$ ]]; then
			echo "::error file=$file,line=$lineno::$owner/$name@${commit:0:7} has no version comment like '# v1.2.3' (found '$release')"
			fail=1
			continue
		fi
		# One pair of commit and release for each repository, in the whole tree.
		key="$owner/$name"
		pair="$commit $release"
		if [ -n "${pair_of[$key]:-}" ] && [ "${pair_of[$key]}" != "$pair" ]; then
			echo "::error file=$file,line=$lineno::$key is pinned to $pair here and to ${pair_of[$key]} in ${pair_file[$key]}; an action has one commit and one release in the whole tree"
			fail=1
		fi
		if [ -z "${pair_of[$key]:-}" ]; then
			pair_of[$key]="$pair"
			pair_file[$key]="$file:$lineno"
		fi
		if [ -z "${asked[$key $pair]:-}" ]; then
			asked[$key $pair]=1
			to_ask+=("$key $release $commit")
		fi
	done <"$file"
done < <(git ls-files -z | { grep -zE '^\.github/.*\.ya?ml$|(^|/)action\.ya?ml$' || true; } | { grep -zv '^\.github/dependabot\.yml$' || true; })

if [ "$files" -eq 0 ]; then
	echo "::error::no workflow or action file found; the check read nothing"
	exit 1
fi

if [ "$remote" -eq 1 ]; then
	for entry in ${to_ask[@]+"${to_ask[@]}"}; do
		read -r repo release commit <<<"$entry"
		if ! answer="$(GIT_TERMINAL_PROMPT=0 git ls-remote "https://github.com/$repo" "refs/tags/$release" "refs/tags/$release^{}" 2>&1)"; then
			echo "::error::could not ask https://github.com/$repo for the tag $release, so $commit is not approved: $answer"
			fail=1
			continue
		fi
		peeled="$(printf '%s\n' "$answer" | awk -v t="refs/tags/$release^{}" '$2 == t { print $1 }')"
		plain="$(printf '%s\n' "$answer" | awk -v t="refs/tags/$release" '$2 == t { print $1 }')"
		expected="${peeled:-$plain}"
		if [ -z "$expected" ]; then
			echo "::error::$repo has no tag $release, which the comment of $commit names"
			fail=1
		elif [ "$expected" != "$commit" ]; then
			echo "::error::$repo $release is the commit $expected, and the workflows pin $commit"
			fail=1
		fi
	done
fi

if [ "$fail" -ne 0 ]; then
	exit 1
fi
echo "$checked references in $files files are fixed to a commit or a digest."
