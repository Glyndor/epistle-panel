import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { sentRequests } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { emailFixture, stubJmap } from "../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { getMailboxesAction } = await import("./get-mailboxes");
const { getMessageListAction } = await import("./get-message-list");
const { getMessageAction } = await import("./get-message");
const { setMailCredentialProvider, interimProvider } = await import(
	"../jmap/credentials"
);

const ID = "00000000-0000-4000-8000-0000000000bb";

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "operator-token";
	await cookies.signIn("admin");
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
	setMailCredentialProvider(interimProvider);
});

describe("every mail action", () => {
	const calls = [
		["getMailboxesAction", () => getMailboxesAction()],
		[
			"getMessageListAction",
			() =>
				getMessageListAction({
					box: "INBOX",
					page: 1,
					filter: "all",
					q: "",
				}),
		],
		["getMessageAction", () => getMessageAction({ id: ID })],
	] as const;

	for (const [name, call] of calls) {
		it(`${name} does not touch JMAP without a session`, async () => {
			cookies.reset();
			stubJmap({});
			expect(await call()).toEqual({
				ok: false,
				reason: "unauthenticated",
			});
			expect(sentRequests()).toHaveLength(0);
		});

		it(`${name} reports unavailable, with nothing of the error, when the provider has no session`, async () => {
			setMailCredentialProvider({ current: async () => null });
			stubJmap({});
			expect(await call()).toEqual({ ok: false, reason: "unavailable" });
			expect(sentRequests()).toHaveLength(0);
		});
	}
});

describe("getMailboxesAction", () => {
	it("returns the folder tree", async () => {
		stubJmap({
			"Mailbox/get": {
				list: [
					{
						id: "INBOX",
						name: "INBOX",
						role: "inbox",
						totalEmails: 1,
						unreadEmails: 1,
					},
				],
			},
		});
		const result = await getMailboxesAction();
		expect(result).toMatchObject({
			ok: true,
			data: [{ id: "INBOX", unread: 1 }],
		});
	});

	it("reports unavailable when JMAP fails", async () => {
		stubJmap({});
		expect(await getMailboxesAction()).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});
});

describe("getMessageListAction", () => {
	it("returns a page", async () => {
		stubJmap({
			"Email/query": { ids: [ID] },
			"Email/get": { list: [emailFixture({ id: ID })] },
		});
		const result = await getMessageListAction({
			box: "INBOX",
			page: 1,
			filter: "all",
			q: "",
		});
		expect(result).toMatchObject({
			ok: true,
			data: { total: 1, items: [{ id: ID }] },
		});
	});

	it("refuses bad input before JMAP is called", async () => {
		stubJmap({});
		for (const input of [
			{ box: "", page: 1, filter: "all", q: "" },
			{ box: "INBOX", page: 0, filter: "all", q: "" },
			{ box: "INBOX", page: 1, filter: "all", q: "", extra: true },
			null,
			"x",
		]) {
			expect(await getMessageListAction(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});
});

describe("getMessageAction", () => {
	it("returns the message, or null when there is none", async () => {
		stubJmap({ "Email/get": { list: [emailFixture({ id: ID })] } });
		expect(await getMessageAction({ id: ID })).toMatchObject({
			ok: true,
			data: { id: ID },
		});
		stubJmap({ "Email/get": { list: [], notFound: [ID] } });
		expect(await getMessageAction({ id: ID })).toEqual({
			ok: true,
			data: null,
		});
	});

	it("refuses an id that is not a UUID before JMAP is called", async () => {
		stubJmap({});
		for (const input of [
			{ id: "../x" },
			{ id: `${ID}.1` },
			{},
			{ id: ID, images: true },
		]) {
			expect(await getMessageAction(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});
});

const { changeMessageAction } = await import("./change-message");

describe("changeMessageAction", () => {
	it("needs a session and a provider session, and refuses bad input before JMAP", async () => {
		cookies.reset();
		stubJmap({});
		expect(await changeMessageAction({ id: ID, op: "read" })).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		await cookies.signIn("admin");
		setMailCredentialProvider({ current: async () => null });
		expect(await changeMessageAction({ id: ID, op: "read" })).toEqual({
			ok: false,
			reason: "unavailable",
		});
		setMailCredentialProvider(interimProvider);
		for (const input of [
			{ id: "x", op: "read" },
			{ id: ID, op: "delete" },
			{ id: ID, op: "move" },
			{ id: ID, op: "move", box: "" },
			{ id: ID, op: "read", box: "X" },
			{ id: ID, op: "read", extra: 1 },
			null,
		]) {
			expect(await changeMessageAction(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports what happened, a missing folder as a category, and a failure as unavailable", async () => {
		stubJmap({
			"Email/get": {
				list: [
					emailFixture({
						id: ID,
						keywords: {},
						mailboxIds: { INBOX: true },
					}),
				],
			},
			"Mailbox/get": {
				list: [
					{ id: "INBOX", role: "inbox" },
					{ id: "Archive", role: "archive" },
				],
			},
			"Email/set": { updated: { [ID]: null } },
		});
		expect(await changeMessageAction({ id: ID, op: "archive" })).toEqual({
			ok: true,
			data: {
				kind: "done",
				outcome: { left: true, movedTo: "Archive", destroyed: false },
			},
		});
		expect(await changeMessageAction({ id: ID, op: "trash" })).toEqual({
			ok: true,
			data: { kind: "noFolder" },
		});
		stubJmap({});
		expect(await changeMessageAction({ id: ID, op: "read" })).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});
});
