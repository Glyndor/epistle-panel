import { afterEach, describe, expect, it } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadSuppression } from ".";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadSuppression", () => {
	it("maps each address to a row and keeps the next cursor", async () => {
		stubFetchJson({
			addresses: ["a@example.org", "b@example.org"],
			next_cursor: "b@example.org",
		});

		expect(await loadSuppression()).toEqual({
			entries: [
				{ address: "a@example.org" },
				{ address: "b@example.org" },
			],
			nextCursor: "b@example.org",
		});
	});

	it("reports the last page as no next cursor", async () => {
		stubFetchJson({ addresses: [] });

		expect(await loadSuppression()).toEqual({
			entries: [],
			nextCursor: null,
		});
	});

	it("asks the API for the cursor it was given, and for none otherwise", async () => {
		stubFetchJson({ addresses: [] });
		await loadSuppression("a@example.org");
		await loadSuppression();

		const [withCursor, without] = sentRequests();
		expect(withCursor?.url).toEndWith(
			"/api/v1/suppression?after=a%40example.org",
		);
		expect(without?.url).toEndWith("/api/v1/suppression");
	});
});
