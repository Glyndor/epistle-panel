import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import { emailFixture, stubJmap } from "@/features/mail/test-support/jmap-stub";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const {
	FALLBACK_BOX,
	requestMailboxes,
	requestMailSession,
	requestMessage,
	requestQuota,
	resolvePlace,
} = await import(".");

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

describe("requestQuota", () => {
	const quota = {
		"Quota/get": {
			list: [{ resourceType: "octets", used: 40, limit: 100 }],
		},
	};

	it("reads the account's storage", async () => {
		stubJmap(quota);
		expect(await requestQuota()).toEqual({ used: 40, limit: 100 });
	});

	it("is null for an account with no quota in octets, which is not a failure", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		try {
			stubJmap({ "Quota/get": { list: [] } });
			expect(await requestQuota()).toBeNull();
			expect(logged).toHaveBeenCalledTimes(0);
		} finally {
			logged.mockRestore();
		}
	});

	it("asks nothing without a mail session", async () => {
		cookies.reset();
		const seen = stubJmap(quota);
		expect(await requestQuota()).toBeUndefined();
		expect(seen).toHaveLength(0);
	});

	it("logs a failure under its operation name and answers undefined", async () => {
		const logged = spyOn(console, "error").mockImplementation(() => {});
		stubJmap({});
		try {
			expect(await requestQuota()).toBeUndefined();
			expect(logged).toHaveBeenCalledTimes(1);
			expect(String(logged.mock.calls[0]?.[0])).toContain("mail quota");
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

describe("requestMessage", () => {
	const ID = "00000000-0000-4000-8000-0000000000e1";

	it("reads one message, with its subject as safe text", async () => {
		stubJmap({
			"Email/get": {
				list: [emailFixture({ id: ID, subject: "Hello\u202e there" })],
			},
		});

		const message = await requestMessage(ID);

		expect(message?.id).toBe(ID);
		expect(message?.subject).toBe("Hello there");
	});

	it("is null for a message the server does not have", async () => {
		stubJmap({ "Email/get": { list: [] } });

		expect(await requestMessage(ID)).toBeNull();
	});

	it("asks nothing without a mail session", async () => {
		cookies.reset();
		const seen = stubJmap({ "Email/get": { list: [] } });

		expect(await requestMessage(ID)).toBeUndefined();
		expect(seen).toHaveLength(0);
	});

	it("rejects when the server fails, for its callers to answer each in its way", async () => {
		stubJmap({});

		expect(await requestMessage(ID).catch(() => "rejected")).toBe(
			"rejected",
		);
	});
});
