import { describe, expect, it } from "bun:test";

import { mailboxesSchema } from ".";

describe("mailboxesSchema", () => {
	it("reads the stored names and the tree, with a null parent for a top-level mailbox", () => {
		const parsed = mailboxesSchema.parse({
			mailboxes: ["INBOX", "INBOX/Work"],
			tree: [
				{ id: "INBOX", name: "INBOX", parent_id: null },
				{ id: "INBOX/Work", name: "Work", parent_id: "INBOX" },
			],
		});
		expect(parsed.tree[1]?.parent_id).toBe("INBOX");
		expect(parsed.tree[0]?.parent_id).toBeNull();
	});

	it("refuses a tree entry with no parent field", () => {
		expect(
			mailboxesSchema.safeParse({
				mailboxes: [],
				tree: [{ id: "A", name: "A" }],
			}).success,
		).toBe(false);
	});
});
