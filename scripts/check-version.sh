#!/bin/sh
# Fail when debian/changelog and internal/package.json name different versions.
# dpkg-buildpackage reads the .deb version from the changelog and nowhere else,
# so a package.json bump that skips it ships a .deb apt sees as nothing new.
# Reads both files as text: it needs no dpkg and no Node.
set -eu

root=$(cd "$(dirname "$0")/.." && pwd)

package=$(sed -n 's/^[[:space:]]*"version":[[:space:]]*"\([^"]*\)".*/\1/p' "$root/internal/package.json" | head -n 1)
changelog=$(sed -n '1s/^epistle-panel (\([^)]*\)).*/\1/p' "$root/debian/changelog")

if [ -z "$package" ] || [ -z "$changelog" ]; then
	echo "error: could not read a version (package.json: '${package}', debian/changelog: '${changelog}')" >&2
	exit 1
fi

if [ "$package" != "$changelog" ]; then
	echo "error: internal/package.json is ${package} but debian/changelog is ${changelog}" >&2
	exit 1
fi

echo "version ${package}: package.json and debian/changelog agree"
