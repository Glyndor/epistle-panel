import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import { stubJmap } from "@/features/mail/test-support/jmap-stub";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { FALLBACK_BOX, requestMailboxes, requestMailSession, resolvePlace } =
	await import(".");

const boxes = {
	"Mailbox/get": {
		list: [
			{
				id: "Sent",
				name: "Sent",
				role: "sent",
				totalEmails: 0,
				unreadEmails: 0,
			},
			{
				id: "Mail",
				name: "Mail",
				role: "inbox",
				totalEmails: 1,
				unreadEmails: 1,
			},
		],
	},
};

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

describe("requestMailSession", () => {
	it("is the provider's session, and nothing for a session of another role", async () => {
		expect(await requestMailSession()).toEqual({
			accountId: "admin",
			bearer: "t",
		});
		cookies.reset();
		await cookies.signIn("ana", "user");
		expect(await requestMailSession()).toBeNull();
	});
});

describe("requestMailboxes", () => {
	it("reads the folders", async () => {
		stubJmap(boxes);
		expect((await requestMailboxes())?.map((box) => box.id)).toContain(
			"Mail",
		);
	});

	it("asks nothing without a mail session", async () => {
		cookies.reset();
		const seen = stubJmap(boxes);
		expect(await requestMailboxes()).toBeUndefined();
		expect(seen).toHaveLength(0);
	});

	it("logs a failure under its operation name and answers undefined, with nothing of the error", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		stubJmap({});
		try {
			expect(await requestMailboxes()).toBeUndefined();
			expect(logged).toHaveBeenCalledTimes(1);
			expect(String(logged.mock.calls[0]?.[0])).toContain(
				"mail mailboxes",
			);
		} finally {
			logged.mockRestore();
		}
	});
});

describe("resolvePlace", () => {
	it("takes a folder asked for by its id without asking the server", async () => {
		const seen = stubJmap(boxes);
		expect(await resolvePlace({ box: "Archive" })).toEqual({
			box: "Archive",
			role: null,
			unreadable: false,
		});
		expect(seen).toHaveLength(0);
	});

	it("opens a folder by its role, whatever its id and its place in the list", async () => {
		stubJmap(boxes);
		expect(await resolvePlace({ role: "inbox" })).toEqual({
			box: "Mail",
			role: "inbox",
			unreadable: false,
		});
	});

	it("opens the first of two folders with one role", async () => {
		stubJmap({
			"Mailbox/get": {
				list: [
					{
						id: "Sent",
						name: "Sent",
						role: "sent",
						totalEmails: 0,
						unreadEmails: 0,
					},
					{
						id: "Sent Items",
						name: "Sent Items",
						role: "sent",
						totalEmails: 0,
						unreadEmails: 0,
					},
				],
			},
		});
		expect((await resolvePlace({ role: "sent" })).box).toBe("Sent");
	});

	it("has no folder for a role the account lacks, and says which role", async () => {
		stubJmap(boxes);
		expect(await resolvePlace({ role: "junk" })).toEqual({
			box: null,
			role: "junk",
			// The folders were read: the account has none of that role.
			unreadable: false,
		});
	});

	it("falls back for the inbox, and only for it, when the folders cannot be read or none is the inbox", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		try {
			stubJmap({});
			expect(await resolvePlace({ role: "inbox" })).toEqual({
				box: FALLBACK_BOX,
				role: "inbox",
				unreadable: false,
			});
			// Not read is not the same as none: the pane says the server is unreachable.
			expect(await resolvePlace({ role: "trash" })).toEqual({
				box: null,
				role: "trash",
				unreadable: true,
			});
			stubJmap({
				"Mailbox/get": {
					list: [boxes["Mailbox/get"].list[0]],
				},
			});
			expect((await resolvePlace({ role: "inbox" })).box).toBe(
				FALLBACK_BOX,
			);
		} finally {
			logged.mockRestore();
		}
	});
});
