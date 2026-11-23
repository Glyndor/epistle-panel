#!/usr/bin/env bash
# Every `uses:` of a workflow or an action of this repository is fixed to a
# commit, and nothing runs that is not from `actions/` or `github/`.
#
#   scripts/ci/pins/check.sh
#
# A reference passes when it is
#   - local (`./...`), or
#   - `actions/<name>[/<path>]@<40 hex digits>` or `github/<name>[/<path>]@<40 hex digits>`, or
#   - `docker://<image>@sha256:<64 hex digits>`, or
#   - one of the third-party references in ALLOWED_THIRD_PARTY below, which is
#     empty: nothing outside actions/ and github/ runs here.
# A tag, a short or abbreviated SHA, a branch, a missing `@`, an owner that is not
# on the list and an image without a digest each fail, and so does a `uses:` the
# reader cannot take apart (written inside a flow mapping, for instance): a line
# this script does not consume is a line it cannot judge.
#
# It reads every tracked workflow and action: `.github/**/*.yml` and `.yaml`, and
# `action.yml` or `action.yaml` anywhere in the tree.
set -euo pipefail
export LC_ALL=C

# Third-party references that are allowed, by exact owner/name. There are none.
ALLOWED_THIRD_PARTY=()

cd "$(git rev-parse --show-toplevel)"

fail=0
checked=0
files=0
while IFS= read -r -d '' file; do
	[ -f "$file" ] || continue
	files=$((files + 1))
	lineno=0
	while IFS= read -r line || [ -n "$line" ]; do
		lineno=$((lineno + 1))
		case "$line" in *uses:*) ;; *) continue ;; esac
		# Comments are not read.
		stripped="${line%%#*}"
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
		fi
		case "$owner" in
		actions | github) ;;
		*)
			allowed=0
			for ok in ${ALLOWED_THIRD_PARTY[@]+"${ALLOWED_THIRD_PARTY[@]}"}; do
				[ "$ref" != "$ok@$version" ] && [ "$owner/$name" != "$ok" ] || allowed=1
			done
			if [ "$allowed" -ne 1 ]; then
				echo "::error file=$file,line=$lineno::$owner/$name is not from actions/ or github/"
				fail=1
			fi
			;;
		esac
	done <"$file"
done < <(git ls-files -z | { grep -zE '^\.github/.*\.ya?ml$|(^|/)action\.ya?ml$' || true; } | { grep -zv '^\.github/dependabot\.yml$' || true; })

if [ "$files" -eq 0 ]; then
	echo "::error::no workflow or action file found; the check read nothing"
	exit 1
fi
if [ "$fail" -ne 0 ]; then
	exit 1
fi
echo "$checked references in $files files are fixed to a commit or a digest."
