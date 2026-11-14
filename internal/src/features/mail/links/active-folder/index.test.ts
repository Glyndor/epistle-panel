import { describe, expect, it } from "bun:test";

import { activeFolder } from ".";

const boxes = [
	{ id: "INBOX", role: "inbox" },
	{ id: "Sent", role: "sent" },
	{ id: "Sent Items", role: "sent" },
	{ id: "Work/Q4", role: null },
] as const;

const ID = "0190a1b2-c3d4-7e5f-8a6b-7c8d9e0f1a2b";

describe("activeFolder", () => {
	it("reads the mail area's home as the inbox", () => {
		expect(activeFolder("/app/mail", boxes)).toBe("INBOX");
		expect(activeFolder("/app/mail/", boxes)).toBe("INBOX");
	});

	it("reads a role's path as the first folder with that role, with a message open or not", () => {
		expect(activeFolder("/app/mail/inbox", boxes)).toBe("INBOX");
		expect(activeFolder("/app/mail/sent", boxes)).toBe("Sent");
		expect(activeFolder(`/app/mail/sent/${ID}`, boxes)).toBe("Sent");
	});

	it("reads a folder's path as the folder its segment spells", () => {
		expect(activeFolder("/app/mail/folder/Work_2FQ4", boxes)).toBe(
			"Work/Q4",
		);
		expect(activeFolder(`/app/mail/folder/Work_2FQ4/${ID}`, boxes)).toBe(
			"Work/Q4",
		);
		// A second folder with a role is addressed by its name.
		expect(activeFolder("/app/mail/folder/Sent_20Items", boxes)).toBe(
			"Sent Items",
		);
	});

	it("falls back to the folder the page opens when no folder has the inbox role", () => {
		expect(activeFolder("/app/mail", [])).toBe("INBOX");
		expect(activeFolder("/app/mail/inbox", [{ id: "A", role: null }])).toBe(
			"INBOX",
		);
	});

	it("names no folder for a role the account has none of", () => {
		expect(activeFolder("/app/mail/trash", boxes)).toBeNull();
		expect(activeFolder("/app/mail/drafts", [])).toBeNull();
	});

	it("names no folder for a page that is none or a segment that spells none", () => {
		for (const path of [
			"/app/mail/compose",
			"/app/mail/folder",
			"/app/mail/folder/a%2Fb",
			"/app/mail/folder/_zz",
			"/app/mail/Inbox",
			"/app/mailbox",
			"/app/0190a1b2/domains",
			"/",
			"",
		]) {
			expect([path, activeFolder(path, boxes)]).toEqual([path, null]);
		}
	});
});
