import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { accountNameSchema } from "@/lib/api/schemas";
import { stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadMasked } from ".";

const originalFetch = globalThis.fetch;
beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
});
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadMasked", () => {
	it("keeps the rows in order, with a null last use until the address is used", async () => {
		stubFetchJson({
			addresses: [
				{
					address: "news.abcdefgh@example.org",
					label: "News",
					enabled: true,
					created_at: 10,
				},
				{
					address: "shop.abcdefg2@example.org",
					label: "Shop",
					enabled: false,
					created_at: 20,
					last_used_at: 30,
				},
			],
		});

		const rows = await loadMasked(accountNameSchema.parse("alice"));

		expect(rows).toEqual([
			{
				address: "news.abcdefgh@example.org",
				label: "News",
				enabled: true,
				createdAt: 10,
				lastUsedAt: null,
				removable: true,
			},
			{
				address: "shop.abcdefg2@example.org",
				label: "Shop",
				enabled: false,
				createdAt: 20,
				lastUsedAt: 30,
				removable: true,
			},
		]);
	});

	it("marks a row whose address does not have the minted shape as not removable", async () => {
		stubFetchJson({
			addresses: [
				{
					address: "../x@evil",
					label: "x",
					enabled: true,
					created_at: 1,
				},
			],
		});

		const rows = await loadMasked(accountNameSchema.parse("alice"));

		expect(rows[0]?.removable).toBe(false);
	});
});
