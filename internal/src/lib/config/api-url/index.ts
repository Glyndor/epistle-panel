import "server-only";

import { isIPv6 } from "node:net";

import { ConfigError } from "../config-error";

/** Where the API listens when `EPISTLE_API_URL` is unset: the container's loopback. */
export const DEFAULT_API_URL = "http://127.0.0.1:8025";

const URL_VAR = "EPISTLE_API_URL";
const ALLOW_VAR = "EPISTLE_API_ALLOW_HTTP_HOSTS";

/** Names cloud metadata services answer on, refused whatever the scheme. */
const METADATA_NAMES = new Set(["metadata", "metadata.google.internal"]);

function ipv4Octets(host: string): number[] | undefined {
	if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
		return undefined;
	}
	return host.split(".").map(Number);
}

/** Expand a canonical IPv6 literal (no brackets, no dotted tail) to 8 groups. */
function ipv6Groups(host: string): number[] | undefined {
	if (!isIPv6(host)) {
		return undefined;
	}
	const [head = "", tail] = host.split("::");
	const left = head === "" ? [] : head.split(":");
	const right = tail === undefined || tail === "" ? [] : tail.split(":");
	const gap = tail === undefined ? 0 : 8 - left.length - right.length;
	const groups = [...left, ...Array<string>(gap).fill("0"), ...right];
	return groups.length === 8
		? groups.map((group) => Number.parseInt(group, 16))
		: undefined;
}

/** Address classes for an IPv4 address given as four octets. */
function classifyV4([a = 0, b = 0, c = 0, d = 0]: number[]):
	| "loopback"
	| "refused"
	| "other" {
	if (a === 127) {
		return "loopback";
	}
	// 0.0.0.0/8 reaches the local host on Linux, 169.254.0.0/16 is link-local
	// (cloud metadata lives at 169.254.169.254), and 100.100.100.200 is the
	// Alibaba Cloud metadata address.
	if (
		a === 0 ||
		(a === 169 && b === 254) ||
		(a === 100 && b === 100 && c === 100 && d === 200)
	) {
		return "refused";
	}
	return "other";
}

function classifyV6(groups: number[]): "loopback" | "refused" | "other" {
	const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] =
		groups;
	const leadingZeros =
		g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
	if (leadingZeros && g5 === 0 && g6 === 0) {
		// ::1 is loopback; :: is the unspecified address.
		return g7 === 1 ? "loopback" : g7 === 0 ? "refused" : "other";
	}
	// fe80::/10 is link-local.
	if ((g0 & 0xffc0) === 0xfe80) {
		return "refused";
	}
	// fd00:ec2::254 is the AWS metadata address.
	if (g0 === 0xfd00 && g1 === 0x0ec2 && g2 === 0 && g7 === 0x254) {
		return "refused";
	}
	// ::ffff:a.b.c.d (IPv4-mapped) and 64:ff9b::a.b.c.d (NAT64) carry an IPv4
	// address that must pass the IPv4 rules.
	const mapped = leadingZeros && g5 === 0xffff;
	const nat64 =
		g0 === 0x64 &&
		g1 === 0xff9b &&
		g2 === 0 &&
		g3 === 0 &&
		g4 === 0 &&
		g5 === 0;
	if (mapped || nat64) {
		const v4 = classifyV4([g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff]);
		// A NAT64 gateway is not this host, so its "loopback" is a remote one.
		return v4 === "loopback" && nat64 ? "other" : v4;
	}
	return "other";
}

type HostClass = "loopback" | "refused" | "other";

function classifyHost(hostname: string): HostClass {
	// Hostnames in a WHATWG URL are lowercase and IPv6 keeps its brackets.
	const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
	if (METADATA_NAMES.has(host)) {
		return "refused";
	}
	const v4 = ipv4Octets(host);
	if (v4) {
		return classifyV4(v4);
	}
	const v6 = ipv6Groups(host);
	if (v6) {
		return classifyV6(v6);
	}
	if (host === "localhost" || host.endsWith(".localhost")) {
		return "loopback";
	}
	return "other";
}

function fail(reason: string): never {
	// The value is never echoed: it may carry credentials.
	throw new ConfigError(`${URL_VAR} ${reason}`);
}

/**
 * Validate the management API base URL and return its origin without a
 * trailing slash.
 *
 * Accepts `http` or `https` only, with no credentials, query, fragment or path
 * (requests append `/api/v1/...` themselves). Refuses link-local and metadata
 * addresses outright: `169.254.0.0/16`, `fe80::/10`, the IPv4 addresses those
 * carry when mapped into IPv6, the unspecified address and the well-known
 * metadata names. Plain `http` is accepted only for a loopback host or a host
 * listed in `allowHttpHosts`, since the bearer token travels on that link.
 *
 * Hostnames are not resolved, so a name that resolves to a refused address is
 * not caught here; the check covers what can be read off the URL.
 *
 * Throws an error that names `EPISTLE_API_URL` and the reason, never the value.
 */
export function parseApiUrl(
	raw: string,
	allowHttpHosts: readonly string[] = [],
): string {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return fail("is not a valid URL");
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") {
		fail("must use http or https");
	}
	if (url.username !== "" || url.password !== "") {
		fail("must not embed credentials");
	}
	if (
		url.pathname !== "/" ||
		url.search !== "" ||
		url.hash !== "" ||
		raw.includes("?") ||
		raw.includes("#")
	) {
		fail("must be a bare origin with no path, query or fragment");
	}
	const kind = classifyHost(url.hostname);
	if (kind === "refused") {
		fail("must not point at a link-local or metadata address");
	}
	if (url.protocol === "http:" && kind !== "loopback") {
		const host = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
		if (!allowHttpHosts.includes(host)) {
			fail(
				`must use https unless the host is loopback or listed in ${ALLOW_VAR}`,
			);
		}
	}
	return url.origin;
}

let memo: { key: string; origin: string } | undefined;

/**
 * The validated base URL of the management API, read from `EPISTLE_API_URL`
 * (default `DEFAULT_API_URL`) and `EPISTLE_API_ALLOW_HTTP_HOSTS`, a comma
 * separated list of hosts that may be reached over plain `http`.
 *
 * Validated once per distinct configuration, so every request pays a map
 * lookup. Throws when the configuration is refused; callers must not send a
 * request in that case.
 */
export function apiBaseUrl(): string {
	const raw = process.env[URL_VAR] ?? DEFAULT_API_URL;
	const allowRaw = process.env[ALLOW_VAR] ?? "";
	const key = `${raw}\0${allowRaw}`;
	if (memo?.key === key) {
		return memo.origin;
	}
	const allow = allowRaw
		.split(",")
		.map((host) => host.trim().toLowerCase())
		.filter((host) => host !== "");
	const origin = parseApiUrl(raw, allow);
	memo = { key, origin };
	return origin;
}
