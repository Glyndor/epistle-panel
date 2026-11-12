import { describe, expect, it } from "bun:test";

import {
	parseCursorParam,
	queueEntryIdSchema,
	queuePageInputSchema,
	removeEntryInputSchema,
} from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

describe("parseCursorParam", () => {
	it("keeps a UUID and drops everything else", () => {
		expect(parseCursorParam(ID)).toBe(ID);
		for (const value of [
			undefined,
			"",
			"abc",
			"1",
			`${ID}x`,
			"../queue",
			`${ID}\n`,
		]) {
			expect(parseCursorParam(value)).toBeUndefined();
		}
	});

	it("uses only the first value of a repeated parameter", () => {
		expect(parseCursorParam([ID, "other"])).toBe(ID);
		expect(parseCursorParam(["other", ID])).toBeUndefined();
		expect(parseCursorParam([])).toBeUndefined();
	});
});

describe("queuePageInputSchema", () => {
	it("accepts no cursor or a UUID cursor", () => {
		expect(queuePageInputSchema.safeParse({}).success).toBe(true);
		expect(queuePageInputSchema.safeParse({ cursor: ID }).success).toBe(
			true,
		);
	});

	it("refuses a bad cursor, an unknown field and a non-object", () => {
		for (const input of [
			{ cursor: "x" },
			{ cursor: ID, limit: 9999 },
			null,
			"x",
			[],
			undefined,
		]) {
			expect(queuePageInputSchema.safeParse(input).success).toBe(false);
		}
	});
});

describe("removeEntryInputSchema", () => {
	it("needs exactly an entry UUID", () => {
		expect(removeEntryInputSchema.safeParse({ id: ID }).success).toBe(true);
		for (const input of [
			{},
			{ id: "1" },
			{ id: ID, extra: 1 },
			{ id: 5 },
			ID,
		]) {
			expect(removeEntryInputSchema.safeParse(input).success).toBe(false);
		}
		expect(queueEntryIdSchema.parse(ID) as string).toBe(ID);
	});
});
