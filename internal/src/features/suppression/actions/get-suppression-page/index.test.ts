import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { getSuppressionPageAction } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("getSuppressionPageAction", () => {
	it("returns a page for a signed-in admin and forwards a valid cursor", async () => {
		await cookies.signIn();
		stubFetchJson({ addresses: ["b@x.org"], next_cursor: "b@x.org" });

		expect(await getSuppressionPageAction({ after: "a@x.org" })).toEqual({
			ok: true,
			data: { entries: [{ address: "b@x.org" }], nextCursor: "b@x.org" },
		});
		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/suppression?after=a%40x.org",
		);
	});

	it("refuses anything but an optional address cursor before the API is called", async () => {
		await cookies.signIn();
		stubFetchJson({ addresses: [] });

		for (const input of [
			{ after: "x" },
			{ limit: 1000 },
			"x",
			null,
			{ after: "a@x.org&account=y@x.org" },
			{ after: "a@x.org\nBcc: z@x.org" },
			{ after: `${"a".repeat(300)}@x.org` },
		]) {
			expect(await getSuppressionPageAction(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("does not touch the API without a session", async () => {
		stubFetchJson({ addresses: [] });

		expect(await getSuppressionPageAction({})).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});
});
