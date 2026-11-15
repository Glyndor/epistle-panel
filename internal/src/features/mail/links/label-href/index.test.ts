import { describe, expect, it } from "bun:test";

import { labelHref } from ".";

const BOXES = [
	{ id: "INBOX", role: "inbox" },
	{ id: "Sent", role: "sent" },
	{ id: "Old sent", role: "sent" },
	{ id: "Work", role: null },
] as const;

describe("labelHref", () => {
	it("opens the folder the person is in, narrowed by the label and by nothing else", () => {
		expect<string>(labelHref("Work", "INBOX", BOXES)).toBe(
			"/app/mail/inbox?label=Work",
		);
		expect<string>(labelHref("Work", "Work", BOXES)).toBe(
			"/app/mail/folder/Work?label=Work",
		);
	});

	it("opens the inbox from a page that is no folder", () => {
		expect<string>(labelHref("Work", null, BOXES)).toBe(
			"/app/mail/inbox?label=Work",
		);
		expect<string>(labelHref("Work", null, undefined)).toBe(
			"/app/mail/inbox?label=Work",
		);
	});

	it("addresses a folder by its role only when it is the first with that role", () => {
		expect<string>(labelHref("a", "Sent", BOXES)).toBe(
			"/app/mail/sent?label=a",
		);
		expect<string>(labelHref("a", "Old sent", BOXES)).toBe(
			"/app/mail/folder/Old_20sent?label=a",
		);
	});

	it("addresses the folder by its id when the folders are not known", () => {
		expect<string>(labelHref("a", "INBOX", undefined)).toBe(
			"/app/mail/folder/INBOX?label=a",
		);
		expect<string>(labelHref("a", "Gone", BOXES)).toBe(
			"/app/mail/folder/Gone?label=a",
		);
	});

	it("writes a keyword that needs it as the address needs it", () => {
		expect<string>(labelHref("To_20do", "INBOX", BOXES)).toBe(
			"/app/mail/inbox?label=To_20do",
		);
		expect<string>(labelHref("a+b", "INBOX", BOXES)).toBe(
			"/app/mail/inbox?label=a%2Bb",
		);
	});
});
