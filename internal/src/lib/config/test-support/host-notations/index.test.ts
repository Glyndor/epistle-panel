import { describe, expect, it } from "bun:test";

import { createRng } from "@/test/prng";

import { refusedByModel, refusedHost, refusedV4, v4Form, wrap } from ".";

describe("host notations", () => {
	it("writes one IPv4 address in forms a URL parser reads back as that address", () => {
		const rng = createRng(1);
		for (let i = 0; i < 500; i++) {
			const octets: [number, number, number, number] = [
				rng.int(0, 255),
				rng.int(0, 255),
				rng.int(0, 255),
				rng.int(0, 255),
			];
			const host = v4Form(octets, rng);
			expect([host, new URL(`http://${host}`).hostname]).toEqual([
				host,
				octets.join("."),
			]);
		}
	});

	it("builds refused hosts that the independent model also refuses, in canonical form", () => {
		const rng = createRng(2);
		for (let i = 0; i < 1000; i++) {
			const raw = wrap(refusedHost(rng), rng);
			const { hostname } = new URL(raw);
			expect([raw, refusedByModel(hostname)]).toEqual([raw, true]);
		}
	});

	it("does not refuse ordinary addresses", () => {
		for (const host of [
			"127.0.0.1",
			"10.0.0.1",
			"169.253.255.255",
			"169.255.0.0",
			"100.100.100.201",
			"[::1]",
			"[2001:db8::1]",
			"[fec0::1]",
			"[::ffff:7f00:1]",
			"example.org",
		]) {
			expect([
				host,
				refusedByModel(new URL(`https://${host}`).hostname),
			]).toEqual([host, false]);
		}
		const [a] = refusedV4(createRng(3));
		expect([0, 169, 100]).toContain(a);
	});
});
