import { BlockList } from "node:net";

import type { Rng } from "@/test/prng";

/**
 * Notations of IPv4 and IPv6 hosts, and an independent check of which
 * addresses the API URL must refuse, shared by the generated-input tests.
 */

/** A number written in a radix `URL` reads as an IPv4 part. */
export function inRadix(n: number, rng: Rng): string {
	switch (rng.int(0, 2)) {
		case 0:
			return String(n);
		case 1:
			return n === 0 ? "0" : `0${n.toString(8)}`;
		default: {
			const hex = n.toString(16);
			return `0${rng.chance() ? "x" : "X"}${rng.chance() ? hex : hex.toUpperCase()}`;
		}
	}
}

/** The same IPv4 address written in a random one-to-four part form. */
export function v4Form(o: [number, number, number, number], rng: Rng): string {
	const [a, b, c, d] = o;
	const forms = [
		[a, b, c, d],
		[a, b, c * 256 + d],
		[a, b * 65536 + c * 256 + d],
		[a * 16777216 + b * 65536 + c * 256 + d],
	];
	const parts = rng.pick(forms);
	const text = parts.map((n) => inRadix(n, rng)).join(".");
	return rng.chance(0.2) ? `${text}.` : text;
}

/** `n` in hexadecimal, in either letter case. */
export function hex(n: number, rng: Rng): string {
	return rng.chance() ? n.toString(16) : n.toString(16).toUpperCase();
}

/** Eight groups as an IPv6 literal, with a random run of zeros compressed. */
export function v6Form(groups: number[], rng: Rng): string {
	const text = groups.map((g) => hex(g, rng));
	if (rng.chance(0.4)) {
		return text.join(":");
	}
	let best = { start: -1, length: 0 };
	for (let i = 0; i < 8; i++) {
		let j = i;
		while (j < 8 && groups[j] === 0) {
			j++;
		}
		if (j - i > best.length) {
			best = { start: i, length: j - i };
		}
	}
	if (best.length < 2) {
		return text.join(":");
	}
	const head = text.slice(0, best.start).join(":");
	const tail = text.slice(best.start + best.length).join(":");
	return `${head}::${tail}`;
}

/** An IPv4 address as four octets. */
export type V4 = [number, number, number, number];

/** A refused IPv4 address: 0.0.0.0/8, 169.254.0.0/16 or the Alibaba metadata one. */
export function refusedV4(rng: Rng): V4 {
	switch (rng.int(0, 2)) {
		case 0:
			return [0, rng.int(0, 255), rng.int(0, 255), rng.int(0, 255)];
		case 1:
			return [169, 254, rng.int(0, 255), rng.int(0, 255)];
		default:
			return [100, 100, 100, 200];
	}
}

/** A refused host in a random notation, ready for the host part of a URL. */
export function refusedHost(rng: Rng): string {
	const kind = rng.int(0, 6);
	if (kind <= 1) {
		return v4Form(refusedV4(rng), rng);
	}
	if (kind === 2) {
		const [a, b, c, d] = refusedV4(rng);
		const tail = rng.chance()
			? `${hex(a * 256 + b, rng)}:${hex(c * 256 + d, rng)}`
			: `${a}.${b}.${c}.${d}`;
		const head = rng.pick(["::ffff:", "0:0:0:0:0:ffff:", "::FFFF:"]);
		return `[${head}${tail}]`;
	}
	if (kind === 3) {
		const [a, b, c, d] = refusedV4(rng);
		const tail = rng.chance()
			? `${hex(a * 256 + b, rng)}:${hex(c * 256 + d, rng)}`
			: `${a}.${b}.${c}.${d}`;
		return `[${rng.pick(["64:ff9b::", "64:ff9b:0:0:0:0:"])}${tail}]`;
	}
	if (kind === 4) {
		const group0 = 0xfe80 + rng.int(0, 63);
		const rest = Array.from({ length: 7 }, () =>
			rng.chance(0.5) ? 0 : rng.int(0, 0xffff),
		);
		return `[${v6Form([group0, ...rest], rng)}]`;
	}
	if (kind === 5) {
		return rng.pick([
			"[::]",
			"[::0]",
			"[0:0:0:0:0:0:0:0]",
			"[0000::0000]",
			"[fd00:ec2::254]",
			"[FD00:EC2:0:0:0:0:0:254]",
			"[fd00:0ec2::0254]",
		]);
	}
	const name = rng.pick(["metadata", "metadata.google.internal"]);
	const cased = Array.from(name, (c) => (rng.chance() ? c.toUpperCase() : c));
	return cased.join("") + (rng.chance(0.3) ? "." : "");
}

/** A bare origin for `host`: random scheme and letter case, optional port and slash. */
export function wrap(host: string, rng: Rng): string {
	const scheme = rng.pick(["http", "https", "HTTP", "HttpS"]);
	const port = rng.chance(0.5) ? `:${rng.int(1, 65535)}` : "";
	return `${scheme}://${host}${port}${rng.chance(0.3) ? "/" : ""}`;
}

const refusedRanges = new BlockList();
refusedRanges.addSubnet("0.0.0.0", 8, "ipv4");
refusedRanges.addSubnet("169.254.0.0", 16, "ipv4");
refusedRanges.addAddress("100.100.100.200", "ipv4");
refusedRanges.addSubnet("fe80::", 10, "ipv6");
refusedRanges.addAddress("::", "ipv6");
refusedRanges.addAddress("fd00:ec2::254", "ipv6");

/** Independent check of a canonical host, written against `BlockList`. */
export function refusedByModel(hostname: string): boolean {
	const host = hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
	if (host === "metadata" || host === "metadata.google.internal") {
		return true;
	}
	if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
		return refusedRanges.check(host, "ipv4");
	}
	if (host.includes(":")) {
		if (refusedRanges.check(host, "ipv6")) {
			return true;
		}
		const nat64 = /^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
		if (nat64) {
			const hi = Number.parseInt(nat64[1] as string, 16);
			const lo = Number.parseInt(nat64[2] as string, 16);
			return refusedRanges.check(
				`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`,
				"ipv4",
			);
		}
	}
	return false;
}
