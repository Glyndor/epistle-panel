import { describe, expect, it } from "bun:test";

import { dayHref } from ".";

const BOXES = [
	{ id: "INBOX", role: "inbox" },
	{ id: "Work", role: null },
] as const;

describe("dayHref", () => {
	it("opens the folder the person is in with both ends of the search on the day", () => {
		expect<string>(dayHref("2026-11-10", "INBOX", BOXES)).toBe(
			"/app/mail/inbox?after=2026-11-10&before=2026-11-10",
		);
		expect<string>(dayHref("2026-11-10", "Work", BOXES)).toBe(
			"/app/mail/folder/Work?after=2026-11-10&before=2026-11-10",
		);
	});

	it("opens the inbox from a page that is no folder", () => {
		expect<string>(dayHref("2026-01-05", null, BOXES)).toBe(
			"/app/mail/inbox?after=2026-01-05&before=2026-01-05",
		);
	});

	it("is the folder alone when the day is taken off", () => {
		expect<string>(dayHref(null, "Work", BOXES)).toBe(
			"/app/mail/folder/Work",
		);
	});

	it("never builds a link from text the list would refuse", () => {
		for (const bad of [
			"",
			"2026-02-30",
			"1969-12-31",
			"tomorrow",
			"2026-11-10&x=1",
		]) {
			expect(() => dayHref(bad, "INBOX", BOXES)).toThrow(RangeError);
		}
	});
});
