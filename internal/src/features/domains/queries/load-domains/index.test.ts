import { afterEach, describe, expect, it } from "bun:test";

import { stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadDomains } from ".";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadDomains", () => {
	it("turns the API's names into rows", async () => {
		stubFetchJson({ domains: ["a.example", "b.example"] });

		expect(await loadDomains()).toEqual([
			{ name: "a.example" },
			{ name: "b.example" },
		]);
	});
});
