import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { accountNameSchema } from "@/lib/api/schemas";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadMailboxes } from ".";

const originalFetch = globalThis.fetch;
beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadMailboxes", () => {
	it("gives each mailbox its last level and its depth in the tree", async () => {
		stubFetchJson({
			mailboxes: ["INBOX", "INBOX/Work", "INBOX/Work/2026", "Archive"],
			tree: [
				{ id: "INBOX", name: "INBOX", parent_id: null },
				{ id: "INBOX/Work", name: "Work", parent_id: "INBOX" },
				{
					id: "INBOX/Work/2026",
					name: "2026",
					parent_id: "INBOX/Work",
				},
				{ id: "Archive", name: "Archive", parent_id: null },
			],
		});

		expect(await loadMailboxes(accountNameSchema.parse("alice"))).toEqual([
			{ id: "INBOX", name: "INBOX", depth: 0 },
			{ id: "INBOX/Work", name: "Work", depth: 1 },
			{ id: "INBOX/Work/2026", name: "2026", depth: 2 },
			{ id: "Archive", name: "Archive", depth: 0 },
		]);
		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/accounts/alice/mailboxes",
		);
	});

	it("stops at a parent cycle instead of looping, and caps the depth", async () => {
		stubFetchJson({
			mailboxes: ["a", "b"],
			tree: [
				{ id: "a", name: "a", parent_id: "b" },
				{ id: "b", name: "b", parent_id: "a" },
			],
		});

		const rows = await loadMailboxes(accountNameSchema.parse("alice"));

		expect(rows.map((row) => row.depth)).toEqual([4, 4]);
	});
});
