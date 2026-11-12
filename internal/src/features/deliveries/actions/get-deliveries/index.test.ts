import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { getDeliveriesAction } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("getDeliveriesAction", () => {
	it("returns the records for a signed-in admin and forwards valid filters", async () => {
		await cookies.signIn();
		stubFetchJson({ entries: [] });

		expect(
			await getDeliveriesAction({ outcome: "failed", since: "1h" }),
		).toEqual({
			ok: true,
			data: { entries: [], logDisabled: false, full: false },
		});
		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/deliveries?outcome=failed&since=1h&limit=100",
		);
	});

	it("refuses hostile filters before the API is called", async () => {
		await cookies.signIn();
		stubFetchJson({ entries: [] });

		for (const input of [
			{ outcome: "failed&account=other" },
			{ outcome: "wonky" },
			{ since: "7d&limit=9999" },
			{ since: "../x" },
			{ recipient: "a@b.org\nBcc: c@d.org" },
			{ recipient: "../status" },
			{ recipient: `${"a".repeat(255)}@b.org` },
			{ limit: 1 },
			"x",
			null,
		]) {
			expect(await getDeliveriesAction(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("does not touch the API without a session", async () => {
		stubFetchJson({ entries: [] });

		expect(await getDeliveriesAction({})).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});
});
