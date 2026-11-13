import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { SESSION, stubJmap } from "../../test-support/jmap-stub";
import { loadMailboxes } from ".";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

describe("loadMailboxes", () => {
	it("asks for every mailbox of the session's account and returns the tree", async () => {
		const seen = stubJmap({
			"Mailbox/get": {
				list: [
					{
						id: "Sent",
						name: "Sent",
						parentId: null,
						role: "sent",
						totalEmails: 4,
						unreadEmails: 0,
					},
					{
						id: "INBOX",
						name: "INBOX",
						parentId: null,
						role: "inbox",
						totalEmails: 9,
						unreadEmails: 2,
					},
				],
			},
		});

		const boxes = await loadMailboxes(SESSION);

		expect(boxes.map((b) => [b.id, b.unread])).toEqual([
			["INBOX", 2],
			["Sent", 0],
		]);
		expect(seen[0]?.calls[0]?.[0]).toBe("Mailbox/get");
		expect(seen[0]?.calls[0]?.[1]).toMatchObject({
			accountId: "admin",
			ids: null,
		});
	});

	it("fails when the server's list does not fit", async () => {
		stubJmap({ "Mailbox/get": { list: [{ id: 1 }] } });
		expect(await loadMailboxes(SESSION).catch((e) => e)).toBeInstanceOf(
			Error,
		);
	});
});
