import { describe, expect, it } from "bun:test";

import { deliveriesSchema } from ".";

const entry = {
	time: 1_700_000_000,
	spool_id: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
	account: "alice",
	from: "a@example.org",
	recipient: "b@example.net",
	outcome: "delivered",
	remote: "mx.example.net",
	reply: "250 ok",
	attempt: 1,
	extra: { campaign: "x" },
};

describe("deliveriesSchema", () => {
	it("parses a record, and a record whose nullable fields are null", () => {
		expect(
			deliveriesSchema.parse({ entries: [entry] }).entries,
		).toHaveLength(1);
		const bare = {
			...entry,
			account: null,
			remote: null,
			reply: null,
			extra: {},
		};
		expect(
			deliveriesSchema.parse({ entries: [bare] }).entries[0]?.account,
		).toBeNull();
	});

	it("parses an empty page", () => {
		expect(deliveriesSchema.parse({ entries: [] }).entries).toEqual([]);
	});

	it("rejects an unknown outcome, a bad id, a time out of range", () => {
		for (const bad of [
			{ ...entry, outcome: "wonky" },
			{ ...entry, spool_id: "nope" },
			{ ...entry, time: -1 },
			{ ...entry, time: 1.5 },
			{ ...entry, time: 253_402_300_800 },
			{ ...entry, attempt: -1 },
			{ ...entry, recipient: undefined },
		]) {
			expect(() => deliveriesSchema.parse({ entries: [bad] })).toThrow();
		}
	});
});
