#!/bin/sh
# Runs inside the container started by debian-smoke.sh, as root.
set -eu

fail() {
	echo "FAIL: $*" >&2
	exit 1
}

check_path() {
	# $1 path, $2 expected "owner:group mode"
	actual=$(stat -c '%U:%G %a' -- "$1") || fail "$1 is missing"
	[ "$actual" = "$2" ] || fail "$1 is '$actual', expected '$2'"
	echo "ok   $1 $actual"
}

apt-get update -qq >/dev/null
apt-get install -y -qq --no-install-recommends adduser python3-yaml >/dev/null
dpkg --force-depends -i /pkg/epistle-panel.deb

[ "$(id -u glyndor-epistle-panel)" ] || fail "account is missing"
[ "$(getent passwd glyndor-epistle-panel | cut -d: -f7)" = /usr/sbin/nologin ] || fail "account has a login shell"
echo "ok   account glyndor-epistle-panel, shell /usr/sbin/nologin"

check_path /etc/glyndor/epistle-panel glyndor-epistle-panel:glyndor-epistle-panel\ 750
check_path /etc/glyndor/epistle-panel/secrets glyndor-epistle-panel:glyndor-epistle-panel\ 700
check_path /var/lib/glyndor/epistle-panel glyndor-epistle-panel:glyndor-epistle-panel\ 750
secret=/etc/glyndor/epistle-panel/secrets/epistle_panel_session_secret
check_path "$secret" glyndor-epistle-panel:glyndor-epistle-panel\ 400
[ "$(wc -c <"$secret")" -ge 43 ] || fail "session secret is shorter than 32 bytes of entropy"
[ ! -e /etc/glyndor/epistle-panel/secrets/epistle_api_token ] || fail "the API token must not be created"
echo "ok   session secret generated, API token not invented"

fragment=/usr/share/glyndor/epistle-panel/compose.yaml
check_path "$fragment" root:root\ 644
grep -q 'image: ghcr.io/glyndor/epistle-panel:0.1.0$' "$fragment" || fail "image is not pinned to the package version"
python3 - "$fragment" <<'PY' || fail "compose fragment did not parse or is missing a hardening key"
import sys, yaml
doc = yaml.safe_load(open(sys.argv[1]))
svc = doc["services"]["epistle-panel"]
assert svc["ports"] == ["127.0.0.1:7587:7587"], svc["ports"]
assert svc["read_only"] is True and svc["cap_drop"] == ["ALL"]
assert "no-new-privileges" in svc["security_opt"]
assert set(doc["secrets"]) == {"epistle_api_token", "epistle_panel_session_secret"}
assert not any("TOKEN=" in str(v) or "SECRET=" in str(v) for v in svc["environment"].values())
PY
echo "ok   compose fragment parses, image pinned, loopback port, hardening present"

# A second configure must keep the secret byte for byte.
before=$(sha256sum "$secret")
dpkg --force-depends -i /pkg/epistle-panel.deb >/dev/null
[ "$before" = "$(sha256sum "$secret")" ] || fail "reinstall changed the session secret"
echo "ok   reinstall keeps the session secret"

# Remove keeps data, purge deletes it.
dpkg -r epistle-panel >/dev/null
[ -f "$secret" ] || fail "remove deleted the secret"
getent passwd glyndor-epistle-panel >/dev/null || fail "remove deleted the account"
[ ! -e "$fragment" ] || fail "remove left the fragment"
dpkg -P epistle-panel >/dev/null
[ ! -e /etc/glyndor/epistle-panel ] || fail "purge left /etc/glyndor/epistle-panel"
[ ! -e /var/lib/glyndor/epistle-panel ] || fail "purge left /var/lib/glyndor/epistle-panel"
! getent passwd glyndor-epistle-panel >/dev/null || fail "purge left the account"
! getent group glyndor-epistle-panel >/dev/null || fail "purge left the group"
echo "ok   remove keeps data; purge removes data, account and group"
echo "smoke test passed"
