import { describe, expect, it } from "bun:test";

import {
	EMPTY_CONDITIONS,
	MAX_CONDITION_TEXT,
} from "@/features/mail/schemas/list-conditions-model";

import {
	MAX_PAGE,
	mailboxIdSchema,
	messageIdSchema,
	messageListInputSchema,
	parseListParams,
	partIndexSchema,
} from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

describe("mailboxIdSchema", () => {
	it("accepts a mailbox name, nested and non-ASCII too", () => {
		for (const id of [
			"INBOX",
			"Work/Q4",
			"Facturación 2026",
			"a".repeat(256),
		]) {
			expect(mailboxIdSchema.safeParse(id).success).toBe(true);
		}
	});

	it("refuses empty, long, control, separator and bidi characters", () => {
		for (const id of [
			"",
			"a".repeat(257),
			"a\nb",
			"a\u0000b",
			"a b",
			"a‮b",
			"a⁦b",
		]) {
			expect(mailboxIdSchema.safeParse(id).success).toBe(false);
		}
	});
});

describe("messageIdSchema and partIndexSchema", () => {
	it("take a UUID and a short run of digits only", () => {
		expect(messageIdSchema.safeParse(ID).success).toBe(true);
		for (const bad of ["x", `${ID}.1`, `${ID}/..`, "../etc"]) {
			expect(messageIdSchema.safeParse(bad).success).toBe(false);
		}
		expect(partIndexSchema.safeParse("12").success).toBe(true);
		for (const bad of ["", "1.2", "-1", "1e3", "1234567", "../1"]) {
			expect(partIndexSchema.safeParse(bad).success).toBe(false);
		}
	});
});

describe("messageListInputSchema", () => {
	const ok = {
		box: "INBOX",
		page: 1,
		conditions: { ...EMPTY_CONDITIONS, q: "  hello  " },
	};

	it("trims the search text and accepts the whole range of the page", () => {
		expect(messageListInputSchema.parse(ok).conditions.q).toBe("hello");
		expect(
			messageListInputSchema.safeParse({ ...ok, page: MAX_PAGE }).success,
		).toBe(true);
	});

	it("refuses an unknown field, a bad page and a hostile condition", () => {
		for (const bad of [
			{ ...ok, extra: 1 },
			{ ...ok, page: 0 },
			{ ...ok, page: MAX_PAGE + 1 },
			{ ...ok, page: 1.5 },
			{ ...ok, page: "1" },
			{ ...ok, conditions: { ...EMPTY_CONDITIONS, q: "x".repeat(201) } },
			{ ...ok, conditions: { ...EMPTY_CONDITIONS, q: "a\nb" } },
			{ ...ok, conditions: { ...EMPTY_CONDITIONS, order: "biggest" } },
			{ ...ok, box: "" },
			null,
			"x",
		]) {
			expect(messageListInputSchema.safeParse(bad).success).toBe(false);
		}
	});

	it("keeps the limit of the text conditions in one place", () => {
		expect(MAX_CONDITION_TEXT).toBe(200);
	});
});

describe("parseListParams", () => {
	it("reads what narrows a list and nothing that names a place", () => {
		expect(
			parseListParams({
				page: "3",
				unread: "1",
				q: " hi ",
				box: "Sent",
				msg: ID,
			}),
		).toEqual({
			page: 3,
			conditions: { ...EMPTY_CONDITIONS, q: "hi", unread: true },
			rejected: [],
		});
	});

	it("defaults what is missing, bad or repeated", () => {
		expect(parseListParams({})).toEqual({
			page: 1,
			conditions: EMPTY_CONDITIONS,
			rejected: [],
		});
		expect(parseListParams({ page: "-1", q: "a\u0000b" })).toEqual({
			page: 1,
			conditions: EMPTY_CONDITIONS,
			rejected: ["q"],
		});
		expect(
			parseListParams({ page: ["2", "9"], filter: ["flagged", "all"] }),
		).toEqual({
			page: 2,
			conditions: { ...EMPTY_CONDITIONS, starred: true },
			rejected: [],
		});
		expect(parseListParams({ page: "201" }).page).toBe(1);
		expect(parseListParams({ page: "200" }).page).toBe(200);
	});
});
