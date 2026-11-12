import { describe, expect, it } from "bun:test";

import { archiveListSchema, restoredSchema } from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

describe("archive schemas", () => {
	it("reads an archive listing and a restore confirmation", () => {
		const list = archiveListSchema.parse({
			entries: [{ id: ID, mailbox: "INBOX", deleted_at: 1_700_000_000 }],
		});
		expect(list.entries[0]?.mailbox).toBe("INBOX");
		expect(restoredSchema.parse({ id: ID, restored_to: "INBOX" }).id).toBe(
			ID,
		);
	});

	it("refuses an entry whose id is not a UUID or whose time is not a count", () => {
		for (const entry of [
			{ id: "../x", mailbox: "INBOX", deleted_at: 1 },
			{ id: ID, mailbox: "INBOX", deleted_at: -1 },
			{ id: ID, mailbox: 5, deleted_at: 1 },
		]) {
			expect(
				archiveListSchema.safeParse({ entries: [entry] }).success,
			).toBe(false);
		}
		expect(
			restoredSchema.safeParse({ id: "x", restored_to: "INBOX" }).success,
		).toBe(false);
	});
});
