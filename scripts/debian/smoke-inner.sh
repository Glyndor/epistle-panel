#!/bin/sh
# Runs inside the container started by smoke.sh, as root.
set -eu

fail() {
	echo "FAIL: $*" >&2
	exit 1
}

# What the package must leave behind, as a sorted list of paths with owner and
# mode, taken outside the dpkg and apt bookkeeping.
snapshot() {
	find /etc /var/lib /home /root /srv /opt /usr/share/glyndor -xdev \
		-not -path '/var/lib/dpkg*' -not -path '/var/lib/apt*' \
		-not -path '/var/lib/systemd*' -not -path '/var/lib/pam*' \
		-not -path '/etc/ld.so.cache' -not -path '/etc/alternatives*' \
		-not -path '/etc/.pwd.lock' -not -path '/etc/*-' \
		-printf '%p %u:%g %m\n' 2>/dev/null | sort
}

before=$(snapshot)
passwd_before=$(getent passwd | sort | sha256sum)
group_before=$(getent group | sort | sha256sum)

dpkg --force-depends -i /pkg/epistle-panel.deb >/dev/null 2>&1
after=$(snapshot)

image=/usr/share/glyndor/epistle-panel/image
[ -f "$image" ] || fail "$image is missing"
[ "$(stat -c '%U:%G %a' "$image")" = "root:root 644" ] || fail "$image has the wrong owner or mode"
[ "$(wc -l <"$image")" = 1 ] || fail "$image is not one line"
# The tag it names is the package's own version, not a literal: a literal fails
# on the first release after 0.1.0.
version=$(dpkg-deb -f /pkg/epistle-panel.deb Version)
[ "$(cat "$image")" = "ghcr.io/glyndor/epistle-panel:${version}" ] || fail "$image is '$(cat "$image")', expected tag ${version}"
echo "ok   $image: $(cat "$image")"
[ -f /usr/share/glyndor/epistle-panel/README ] || fail "the README of the pin file is missing"
echo "ok   README present"

new=$(printf '%s\n%s\n' "$before" "$after" | sort | uniq -u | awk '{print $1}')
unexpected=$(echo "$new" | grep -v -E '^/usr/share/glyndor(/epistle-panel(/image|/README)?)?$' || true)
[ -z "$unexpected" ] || fail "paths created outside /usr/share/glyndor: $unexpected"
echo "ok   nothing created beyond /usr/share/glyndor/epistle-panel"
[ "$(getent passwd | sort | sha256sum)" = "$passwd_before" ] || fail "an account was created"
[ "$(getent group | sort | sha256sum)" = "$group_before" ] || fail "a group was created"
! getent passwd glyndor-epistle-panel >/dev/null || fail "glyndor-epistle-panel exists"
echo "ok   no account or group created"
[ ! -e /etc/glyndor ] && [ ! -e /var/lib/glyndor ] || fail "/etc/glyndor or /var/lib/glyndor exists"

# A second install changes nothing.
dpkg --force-depends -i /pkg/epistle-panel.deb >/dev/null 2>&1
[ "$after" = "$(snapshot)" ] || fail "a reinstall changed the file system"
echo "ok   reinstall is idempotent"

# Remove and purge leave the snapshot as it was before the install.
dpkg -r epistle-panel >/dev/null 2>&1
[ ! -e "$image" ] || fail "remove left the pin file"
dpkg -P epistle-panel >/dev/null 2>&1
[ "$before" = "$(snapshot)" ] || fail "purge left something behind"
[ ! -e /usr/share/glyndor/epistle-panel ] || fail "purge left the package directory"
echo "ok   purge leaves the file system as it was before the install"
echo "smoke test passed"
