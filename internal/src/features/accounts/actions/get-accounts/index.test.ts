import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { getAccountsAction } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("getAccountsAction", () => {
	it("returns the rows for a signed-in admin", async () => {
		await cookies.signIn();
		stubFetchJson({ accounts: [] });

		expect(await getAccountsAction()).toEqual({ ok: true, data: [] });
	});

	it("does not reach the API without a session", async () => {
		stubFetchJson({ accounts: [] });

		expect(await getAccountsAction()).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports a malformed API answer as unavailable", async () => {
		await cookies.signIn();
		stubFetchJson({ unexpected: true });

		expect(await getAccountsAction()).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});
});
