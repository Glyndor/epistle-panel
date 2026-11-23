#!/usr/bin/env bash
# Point the public tags of a version at the manifest list that was built, staged and
# attested in this run.
#
# Usage: promote-tags.sh <registry-image> <digest> <version> <published-file>
#
# <digest> is what publish-manifest.sh reported. <published-file> lists the versions of
# the published releases, one per line, the version being promoted included (a release
# is created before this runs). Three rules, each one a refusal and not a warning:
#
#   - the exact tag `<version>` is made once. If it exists and names another digest, the
#     version has been published already and a release is immutable, so nothing moves;
#     if it names this digest (a rerun of a job that failed half way) it is left alone.
#   - a floating tag (`<major>.<minor>`, `<major>`) moves only for the highest published
#     version that shares it, which image_tags.py decides, so an old patch published late
#     never takes `:0.3` or `:0` back.
#   - a tag that cannot be read is not a tag that is absent: only the answers a registry
#     gives for a missing name count as absence, any other failure stops the promotion.
#
# Every tag is read back after it moves and has to name the digest.
set -euo pipefail

usage='usage: promote-tags.sh <registry-image> <digest> <version> <published-file>'
image=${1:?$usage}
digest=${2:?$usage}
version=${3:?$usage}
published=${4:?$usage}
version=${version#v}
here=$(cd "$(dirname "$0")" && pwd)

[[ "$digest" =~ ^sha256:[0-9a-f]{64}$ ]] || { echo "::error::'$digest' is not a sha256 digest" >&2; exit 1; }
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# digest_of <reference>: prints the digest the reference names. Status 2 when the registry
# says the name is not there, 1 for any other failure.
digest_of() {
	local out
	if out=$(skopeo inspect --format '{{.Digest}}' "docker://$1" 2>"$work/err"); then
		printf '%s\n' "$out"
		return 0
	fi
	if grep -qiE 'manifest unknown|name unknown|not found' "$work/err"; then
		return 2
	fi
	cat "$work/err" >&2
	return 1
}

mapfile -t tags < <(python3 -I "$here/image_tags.py" "$version" --published "$published")
[ "${#tags[@]}" -gt 0 ] || { echo "::error::image_tags.py produced no tags for $version" >&2; exit 1; }
exact=${tags[0]}
mapfile -t all < <(python3 -I "$here/image_tags.py" "$version")
for tag in "${all[@]}"; do
	case " ${tags[*]} " in
		*" $tag "*) ;;
		*) echo "::notice::$image:$tag stays where it is: a higher version that shares it is published" ;;
	esac
done

# The list that was staged is there and is the one reported.
got=$(digest_of "$image@$digest") || { echo "::error::the staged list $digest cannot be read from the registry" >&2; exit 1; }
[ "$got" = "$digest" ] || { echo "::error::the registry serves $got for $digest" >&2; exit 1; }

# The exact tag first, before anything moves.
status=0
current=$(digest_of "$image:$exact") || status=$?
case "$status" in
	0) if [ "$current" != "$digest" ]; then
		echo "::error::$image:$exact already names $current; $version is published and a release is immutable" >&2
		exit 1
	fi ;;
	2) ;;
	*) echo "::error::cannot tell whether $image:$exact exists" >&2; exit 1 ;;
esac

for tag in "${tags[@]}"; do
	status=0
	current=$(digest_of "$image:$tag") || status=$?
	case "$status" in
		0) if [ "$current" = "$digest" ]; then
			echo "$image:$tag already names $digest"
			continue
		fi ;;
		2) ;;
		*) echo "::error::cannot tell whether $image:$tag exists" >&2; exit 1 ;;
	esac
	skopeo copy --all --preserve-digests "docker://$image@$digest" "docker://$image:$tag"
	after=$(digest_of "$image:$tag") || { echo "::error::cannot read $image:$tag back" >&2; exit 1; }
	[ "$after" = "$digest" ] || { echo "::error::$image:$tag names $after after the copy, expected $digest" >&2; exit 1; }
	echo "$image:$tag -> $digest"
done
