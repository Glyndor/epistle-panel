import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { getStatusAction } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("getStatusAction", () => {
	it("gives a signed-in admin the counters", async () => {
		await cookies.signIn();
		stubFetchJson({ version: "1", domains: 1, accounts: 2, queue_size: 3 });

		expect(await getStatusAction()).toEqual({
			ok: true,
			data: { version: "1", domains: 1, accounts: 2, queueSize: 3 },
		});
	});

	it("reaches the API only with a session", async () => {
		stubFetchJson({ version: "1", domains: 1, accounts: 2, queue_size: 3 });

		expect(await getStatusAction()).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports an unreachable API as unavailable, without its error", async () => {
		await cookies.signIn();
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const result = await getStatusAction();

		expect(result).toEqual({ ok: false, reason: "unavailable" });
		expect(JSON.stringify(result)).not.toContain("network");
		errors.mockRestore();
	});
});
