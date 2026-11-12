import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { getDomainsAction } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("getDomainsAction", () => {
	it("returns the rows for a signed-in admin", async () => {
		await cookies.signIn();
		stubFetchJson({ domains: [] });

		expect(await getDomainsAction()).toEqual({ ok: true, data: [] });
	});

	it("does not reach the API without a session", async () => {
		stubFetchJson({ domains: [] });

		expect(await getDomainsAction()).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports a malformed API answer as unavailable", async () => {
		await cookies.signIn();
		stubFetchJson({ unexpected: true });

		expect(await getDomainsAction()).toEqual({
			ok: false,
			reason: "unavailable",
		});
	});
});
