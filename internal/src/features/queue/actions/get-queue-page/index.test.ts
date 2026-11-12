import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { getQueuePageAction } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("getQueuePageAction", () => {
	it("returns a page for a signed-in admin and forwards a valid cursor", async () => {
		await cookies.signIn();
		stubFetchJson({ entries: [] });

		expect(await getQueuePageAction({ cursor: ID })).toEqual({
			ok: true,
			data: { entries: [], nextCursor: null },
		});
		expect(sentRequests()[0]?.url).toEndWith(`/api/v1/queue?cursor=${ID}`);
	});

	it("refuses anything but an optional UUID cursor before the API is called", async () => {
		await cookies.signIn();
		stubFetchJson({ entries: [] });

		for (const input of [
			{ cursor: "x" },
			{ limit: 1000 },
			"x",
			null,
			{ cursor: `${ID}&limit=1` },
		]) {
			expect(await getQueuePageAction(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("does not touch the API without a session", async () => {
		stubFetchJson({ entries: [] });

		expect(await getQueuePageAction({})).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});
});
