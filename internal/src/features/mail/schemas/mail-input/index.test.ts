import { describe, expect, it } from "bun:test";

import {
	MAX_PAGE,
	MAX_QUERY_LENGTH,
	mailboxIdSchema,
	messageIdSchema,
	messageListInputSchema,
	parseMailParams,
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
	const ok = { box: "INBOX", page: 1, filter: "all", q: "  hello  " };

	it("trims the search text and accepts the whole range of the page", () => {
		expect(messageListInputSchema.parse(ok).q).toBe("hello");
		expect(
			messageListInputSchema.safeParse({ ...ok, page: MAX_PAGE }).success,
		).toBe(true);
	});

	it("refuses an unknown field, a bad page, an unknown filter and a hostile search", () => {
		for (const bad of [
			{ ...ok, extra: 1 },
			{ ...ok, page: 0 },
			{ ...ok, page: MAX_PAGE + 1 },
			{ ...ok, page: 1.5 },
			{ ...ok, page: "1" },
			{ ...ok, filter: "spam" },
			{ ...ok, q: "x".repeat(MAX_QUERY_LENGTH + 1) },
			{ ...ok, q: "a\nb" },
			{ ...ok, box: "" },
			null,
			"x",
		]) {
			expect(messageListInputSchema.safeParse(bad).success).toBe(false);
		}
	});
});

describe("parseMailParams", () => {
	it("reads valid parameters", () => {
		expect(
			parseMailParams({
				box: "Sent",
				page: "3",
				filter: "unread",
				q: " hi ",
				msg: ID,
			}),
		).toEqual({
			box: "Sent",
			page: 3,
			filter: "unread",
			q: "hi",
			msg: ID,
		});
	});

	it("defaults what is missing and drops each bad value on its own", () => {
		expect(parseMailParams({})).toEqual({
			box: undefined,
			page: 1,
			filter: "all",
			q: "",
			msg: undefined,
		});
		expect(
			parseMailParams({
				box: "a\nb",
				page: "0",
				filter: "evil",
				q: "x\u0000",
				msg: "../x",
			}),
		).toEqual({
			box: undefined,
			page: 1,
			filter: "all",
			q: "",
			msg: undefined,
		});
		expect(parseMailParams({ page: "1e3" }).page).toBe(1);
		expect(parseMailParams({ page: "99999" }).page).toBe(1);
		expect(parseMailParams({ box: "INBOX", filter: "zzz" })).toMatchObject({
			box: "INBOX",
			filter: "all",
		});
	});

	it("uses the first value of a repeated parameter", () => {
		expect(
			parseMailParams({ box: ["A", "B"], msg: [ID, "x"] }),
		).toMatchObject({ box: "A", msg: ID });
	});
});
