import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { sentRequests } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { labelMessagesAction } = await import(".");
const { setMailCredentialProvider, interimProvider } = await import(
	"../../jmap/credentials"
);

const ID = "00000000-0000-4000-8000-0000000000f9";
const input = { kind: "keyword", ids: [ID], keyword: "Work", on: true };

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

describe("labelMessagesAction", () => {
	it("does not touch JMAP without a session", async () => {
		cookies.reset();
		stubJmap({});
		expect(await labelMessagesAction(input)).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports unavailable when the provider has no session", async () => {
		setMailCredentialProvider({ current: async () => null });
		stubJmap({});
		expect(await labelMessagesAction(input)).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});

	it("refuses input the schema does not take, whatever the field did, before any call", async () => {
		const seen = stubJmap({});
		for (const bad of [
			{ ...input, keyword: "$seen" },
			{ kind: "create", ids: [ID], name: "x".repeat(31) },
			{ ...input, ids: [] },
			"nope",
		]) {
			expect(await labelMessagesAction(bad)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(seen).toHaveLength(0);
	});

	it("answers what the server did, message by message", async () => {
		stubJmap({
			"Email/get": { list: [emailFixture({ id: ID, keywords: {} })] },
			"Email/set": { updated: { [ID]: null } },
		});
		expect(await labelMessagesAction(input)).toEqual({
			ok: true,
			data: { keyword: "Work", updated: [ID], failed: [] },
		});
	});

	it("says unavailable, with nothing of the error, when the server fails", async () => {
		stubJmap({});
		expect(await labelMessagesAction(input)).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});
});
