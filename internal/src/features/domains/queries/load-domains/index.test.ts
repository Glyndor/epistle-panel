import { afterEach, describe, expect, it } from "bun:test";

import { stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadDomains } from ".";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadDomains", () => {
	it("turns the API's names into rows, and marks the ones the server has switched off", async () => {
		stubFetchJson({
			domains: ["a.example", "b.example", "c.example"],
			disabled: ["b.example"],
		});

		expect(await loadDomains()).toEqual([
			{ name: "a.example", disabled: false },
			{ name: "b.example", disabled: true },
			{ name: "c.example", disabled: false },
		]);
	});

	it("reads a server that does not say as having none switched off", async () => {
		stubFetchJson({ domains: ["a.example", "b.example"] });

		expect(await loadDomains()).toEqual([
			{ name: "a.example", disabled: false },
			{ name: "b.example", disabled: false },
		]);
	});

	it("does not invent a row for a switched-off name the list does not hold", async () => {
		stubFetchJson({ domains: ["a.example"], disabled: ["z.example"] });

		expect(await loadDomains()).toEqual([
			{ name: "a.example", disabled: false },
		]);
	});
});
