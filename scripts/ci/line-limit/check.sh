#!/usr/bin/env bash
# The file-size standard: a warning past the soft limit, a failure past the hard
# one. It counts code lines of the tracked source files, so blank lines and
# lines that only hold a comment do not count and documenting a function never
# pushes a file over the limit. The comment test is a heuristic: a line whose
# first character after the indent opens a line, block, doc or markup comment.
#
#   scripts/ci/line-limit/check.sh
#
# Settings, from the environment:
#   HARD  a file with more code lines than this fails (default 500)
#   SOFT  a file with more code lines than this warns (default 300)
#   EXTS  the extensions it reads, separated by spaces
#
# What it does not cover: files with other extensions (CSS, JSON, YAML, Markdown),
# files under `vendor/` and minified files.
set -euo pipefail

HARD="${HARD:-500}"
SOFT="${SOFT:-300}"
EXTS="${EXTS:-rs go ts tsx js jsx mjs cjs py sh astro vue svelte}"

case "$HARD$SOFT" in
'' | *[!0-9]*)
	echo "::error::HARD and SOFT must be whole numbers (got HARD='$HARD' SOFT='$SOFT')"
	exit 2
	;;
esac

ext_re="$(echo "$EXTS" | tr ' ' '|')"
ext_pattern="\.(${ext_re})\$"
fail=0
checked=0
while IFS= read -r -d '' f; do
	[[ "$f" =~ $ext_pattern ]] || continue
	[ -f "$f" ] || continue
	case "$f" in
	vendor/* | */vendor/* | *.min.*) continue ;;
	esac
	# `#` starts a comment only in hash-comment languages; in Rust it opens an
	# attribute, so those lines must not be dropped.
	case "$f" in
	*.sh | *.bash | *.py | *.rb | *.pl | *.yml | *.yaml | *.toml) hash_comment=1 ;;
	*) hash_comment=0 ;;
	esac
	n="$(awk -v hc="$hash_comment" '
		{ line = $0; sub(/^[[:space:]]+/, "", line)
		  if (line == "") next
		  if (line ~ /^(\/\/|\*|\/\*|\*\/|<!--)/) next
		  if (hc == 1 && line ~ /^#/) next
		  code++ }
		END { print code + 0 }' "$f")"
	checked=$((checked + 1))
	if [ "$n" -gt "$HARD" ]; then
		echo "::error file=$f::$f has $n code lines (hard limit $HARD, split required)"
		fail=1
	elif [ "$n" -gt "$SOFT" ]; then
		echo "::warning file=$f::$f has $n code lines (soft limit $SOFT, look for a split point)"
	fi
done < <(git ls-files -z)

if [ "$checked" -eq 0 ]; then
	echo "::error::no tracked file matched the extensions '$EXTS'; the check read nothing"
	exit 1
fi
if [ "$fail" -ne 0 ]; then
	echo "Some files exceed the ${HARD}-line hard limit."
	exit 1
fi
echo "${checked} files are within the ${HARD}-line hard limit."
