#!/usr/bin/env bash
# Tests for scripts/release/publish/check-tag.sh. Run from anywhere:
#   bash scripts/release/publish/test-check-tag.sh
# The repository is a real one in a temporary folder, so `git ls-remote` is the real
# command; the tag is moved, deleted and annotated between the run and the check.
set -uo pipefail

here=$(cd "$(dirname "$0")" && pwd)
# shellcheck source=../lib/assertions.sh
. "$here/../lib/assertions.sh"
script="$here/check-tag.sh"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
repo="$tmp/repo"
git init -q "$repo"
g() { git -C "$repo" -c user.name=t -c user.email=t@example.invalid -c commit.gpgsign=false -c tag.gpgsign=false "$@"; }
g commit -q --allow-empty -m one; one=$(g rev-parse HEAD)
g commit -q --allow-empty -m two; two=$(g rev-parse HEAD)

g tag v0.3.0 "$one"
expect_status "a tag that names the commit passes" 0 bash "$script" v0.3.0 "$one" "$repo"

# Attack: the tag is moved to another commit after the last check of the run.
g tag -f v0.3.0 "$two" > /dev/null
expect_status "a tag moved to another commit is refused" 1 bash "$script" v0.3.0 "$one" "$repo"
expect_output "the refusal says nothing is published" "nothing is published"

g tag -d v0.3.0 > /dev/null
expect_status "a tag that is gone is refused" 1 bash "$script" v0.3.0 "$one" "$repo"

g tag -a v0.3.0 "$one" -m annotated
expect_status "an annotated tag is read through the commit it names" 0 bash "$script" v0.3.0 "$one" "$repo"
g tag -f -a v0.3.0 "$two" -m annotated > /dev/null
expect_status "an annotated tag moved to another commit is refused" 1 bash "$script" v0.3.0 "$one" "$repo"

# A branch with the name of the tag is not the tag.
g tag -d v0.3.0 > /dev/null; g branch v0.3.0 "$one"
expect_status "a branch of that name does not stand for the tag" 1 bash "$script" v0.3.0 "$one" "$repo"

expect_status "a repository that cannot be read is refused" 1 bash "$script" v0.3.0 "$one" "$tmp/nowhere"
expect_status "a tag that is not a release tag is refused" 1 bash "$script" v1.0.0-rc.1 "$one" "$repo"
expect_status "a commit that is not a commit is refused" 1 bash "$script" v0.3.0 main "$repo"
expect_status "missing arguments are refused" 1 bash "$script"

finish
