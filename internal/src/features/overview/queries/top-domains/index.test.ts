import { describe, expect, it } from "bun:test";

import { topDomains } from ".";

const at = (domain: string, count: number) =>
	Array.from({ length: count }, (_, index) => `user${index}@${domain}`);

describe("topDomains", () => {
	it("counts addresses by domain, the most first", () => {
		const top = topDomains([
			...at("b.example", 1),
			...at("a.example", 6),
			...at("c.example", 3),
		]);

		expect(top.total).toBe(10);
		expect(top.rows).toEqual([
			{ domain: "a.example", count: 6, share: 600 },
			{ domain: "c.example", count: 3, share: 300 },
			{ domain: "b.example", count: 1, share: 100 },
		]);
	});

	it("keeps five domains and adds the rest up in one last row", () => {
		const top = topDomains([
			...at("one.example", 7),
			...at("two.example", 6),
			...at("three.example", 5),
			...at("four.example", 4),
			...at("five.example", 3),
			...at("six.example", 2),
			...at("seven.example", 1),
		]);

		expect(top.rows.map((row) => row.domain)).toEqual([
			"one.example",
			"two.example",
			"three.example",
			"four.example",
			"five.example",
			null,
		]);
		expect(top.rows[5]).toEqual({ domain: null, count: 3, share: 107 });
		expect(top.rows.reduce((sum, row) => sum + row.share, 0)).toBe(1000);
		expect(top.rows.reduce((sum, row) => sum + row.count, 0)).toBe(28);
	});

	it("has no last row when five domains hold every address", () => {
		const top = topDomains(
			[...at("a.example", 2), ...at("b.example", 1)],
			5,
		);

		expect(top.rows.map((row) => row.domain)).toEqual([
			"a.example",
			"b.example",
		]);
	});

	it("orders two domains with the same count by name", () => {
		const forward = topDomains([
			...at("z.example", 2),
			...at("a.example", 2),
		]);
		const backward = topDomains([
			...at("a.example", 2),
			...at("z.example", 2),
		]);

		expect(forward.rows.map((row) => row.domain)).toEqual([
			"a.example",
			"z.example",
		]);
		expect(backward.rows).toEqual(forward.rows);
	});

	it("reads the domain after the last at sign, whatever its case", () => {
		const top = topDomains([
			"Ana@Example.ORG",
			"ben@example.org",
			'"odd@local"@example.org',
		]);

		expect(top.rows).toEqual([
			{ domain: "example.org", count: 3, share: 1000 },
		]);
	});

	it("counts an address with no domain in the last row", () => {
		const top = topDomains(["no-at-sign", "trailing@", "ok@a.example"]);

		expect(top.rows).toEqual([
			{ domain: "a.example", count: 1, share: 333 },
			{ domain: null, count: 2, share: 667 },
		]);
	});

	it("keeps as many domains as it is asked for", () => {
		const top = topDomains(
			[
				...at("a.example", 3),
				...at("b.example", 2),
				...at("c.example", 1),
			],
			1,
		);

		expect(top.rows).toEqual([
			{ domain: "a.example", count: 3, share: 500 },
			{ domain: null, count: 3, share: 500 },
		]);
	});

	it("has no row for no address", () => {
		expect(topDomains([])).toEqual({ total: 0, rows: [] });
	});
});
