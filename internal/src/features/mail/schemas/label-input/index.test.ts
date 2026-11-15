import { describe, expect, it } from "bun:test";

import { LABEL_NAME_MAX } from "@/features/mail/labels/name-codec";
import { LABEL_BATCH } from "@/features/mail/schemas/label-input-model";
import { labelMessagesInputSchema } from ".";

const ID = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000a2";

const keyword = (over: Record<string, unknown> = {}) =>
	labelMessagesInputSchema.safeParse({
		kind: "keyword",
		ids: [ID],
		keyword: "Work",
		on: true,
		...over,
	}).success;

const create = (over: Record<string, unknown> = {}) =>
	labelMessagesInputSchema.safeParse({
		kind: "create",
		ids: [ID],
		name: "Work",
		...over,
	}).success;

describe("labelMessagesInputSchema", () => {
	it("takes a label's keyword on or off for one or more messages", () => {
		expect(keyword()).toBe(true);
		expect(keyword({ on: false, ids: [ID, OTHER] })).toBe(true);
	});

	it("never takes a keyword of the protocol, so it cannot set a flag", () => {
		for (const bad of ["$seen", "$flagged", "\\Seen", "$important", ""]) {
			expect(keyword({ keyword: bad })).toBe(false);
		}
	});

	it("refuses what the server would not keep as a keyword", () => {
		expect(keyword({ keyword: "two words" })).toBe(false);
		expect(keyword({ keyword: 'q"uote' })).toBe(false);
		expect(keyword({ keyword: "x".repeat(65) })).toBe(false);
		expect(keyword({ keyword: "x".repeat(64) })).toBe(true);
	});

	it("bounds the messages and refuses an id twice or one that is not an id", () => {
		const many = (count: number) =>
			Array.from(
				{ length: count },
				(_, index) =>
					`00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
			);
		expect(keyword({ ids: [] })).toBe(false);
		expect(keyword({ ids: many(LABEL_BATCH) })).toBe(true);
		expect(keyword({ ids: many(LABEL_BATCH + 1) })).toBe(false);
		expect(keyword({ ids: [ID, ID] })).toBe(false);
		expect(keyword({ ids: ["x"] })).toBe(false);
	});

	it("takes a name by the shared rule: exact, at most the limit in bytes", () => {
		expect(create()).toBe(true);
		expect(create({ name: " spaced  out " })).toBe(true);
		expect(create({ name: "" })).toBe(false);
		expect(create({ name: "a".repeat(LABEL_NAME_MAX) })).toBe(true);
		expect(create({ name: "a".repeat(LABEL_NAME_MAX + 1) })).toBe(false);
		// Within the limit in characters, over it in bytes.
		expect(create({ name: "ñ".repeat(LABEL_NAME_MAX) })).toBe(false);
		expect(create({ name: "\ud800" })).toBe(false);
	});

	it("has no way to take a label off by name and takes nothing else", () => {
		expect(
			labelMessagesInputSchema.safeParse({
				kind: "create",
				ids: [ID],
				name: "Work",
				on: false,
			}).success,
		).toBe(false);
		expect(keyword({ extra: 1 })).toBe(false);
		expect(labelMessagesInputSchema.safeParse({ ids: [ID] }).success).toBe(
			false,
		);
	});
});
