#!/usr/bin/env bash
# Refuse to go on when a release tag no longer names the commit the run verified.
#
# Usage: check-tag.sh <tag> <commit> <repository-url>
#
# `verify` resolves the tag once and every job builds that commit, but the tag is a
# name that anyone who may move tags can move afterwards. The release is created from
# the name, so the name is read from the repository once more at the last moment before
# the release becomes visible, and has to name the commit that was built, signed and
# attested. An annotated tag is read through its peeled entry. A tag that cannot be
# read, one that is gone and one that names anything else fail.
set -euo pipefail

usage='usage: check-tag.sh <tag> <commit> <repository-url>'
tag=${1:?$usage}
commit=${2:?$usage}
url=${3:?$usage}

[[ "$tag" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]] || { echo "::error::$tag is not a release tag" >&2; exit 1; }
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo "::error::$commit is not a commit" >&2; exit 1; }

listing=$(git ls-remote --tags "$url" "refs/tags/$tag" "refs/tags/$tag^{}") || {
	echo "::error::cannot read $tag from the repository" >&2
	exit 1
}
current=$(printf '%s\n' "$listing" | awk -v ref="refs/tags/$tag^{}" '$2 == ref { print $1 }')
if [ -z "$current" ]; then
	current=$(printf '%s\n' "$listing" | awk -v ref="refs/tags/$tag" '$2 == ref { print $1 }')
fi
if [ -z "$current" ]; then
	echo "::error::$tag is not in the repository any more" >&2
	exit 1
fi
if [ "$current" != "$commit" ]; then
	echo "::error::$tag names $current now, the run verified and built $commit; nothing is published" >&2
	exit 1
fi
echo "$tag still names $commit"
