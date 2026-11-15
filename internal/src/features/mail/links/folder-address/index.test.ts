import { describe, expect, it } from "bun:test";

import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { folderAddress } from ".";

const BOXES = [
	{ id: "INBOX", role: "inbox" },
	{ id: "Sent", role: "sent" },
	{ id: "Old sent", role: "sent" },
	{ id: "Work", role: null },
] as const;
const FOR_A = { ...EMPTY_CONDITIONS, subject: "a" };

describe("folderAddress", () => {
	it("is the inbox from a page that is no folder", () => {
		expect<string>(folderAddress(null, BOXES, FOR_A)).toBe(
			"/app/mail/inbox?subject=a",
		);
		expect<string>(folderAddress(null, undefined, FOR_A)).toBe(
			"/app/mail/inbox?subject=a",
		);
	});

	it("addresses a folder by its role when it is the first with that role", () => {
		expect<string>(folderAddress("Sent", BOXES, FOR_A)).toBe(
			"/app/mail/sent?subject=a",
		);
		expect<string>(folderAddress("Old sent", BOXES, FOR_A)).toBe(
			"/app/mail/folder/Old_20sent?subject=a",
		);
	});

	it("addresses any other folder, and one the folders do not know, by its id", () => {
		expect<string>(folderAddress("Work", BOXES, FOR_A)).toBe(
			"/app/mail/folder/Work?subject=a",
		);
		expect<string>(folderAddress("INBOX", undefined, FOR_A)).toBe(
			"/app/mail/folder/INBOX?subject=a",
		);
	});

	it("writes no parameter for conditions that narrow nothing", () => {
		expect<string>(folderAddress("INBOX", BOXES, EMPTY_CONDITIONS)).toBe(
			"/app/mail/inbox",
		);
	});
});
