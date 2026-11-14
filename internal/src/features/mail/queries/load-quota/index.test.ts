import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { SESSION, stubJmap } from "../../test-support/jmap-stub";
import { loadQuota } from ".";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});
afterEach(() => {
	process.env = { ...savedEnv };
	globalThis.fetch = originalFetch;
});

/** One quota as epistle sends it. */
const octets = (used: number, limit: number | null) => ({
	id: "mail",
	resourceType: "octets",
	used,
	scope: "account",
	name: "Mail storage",
	types: ["Mail"],
	limit,
});

describe("loadQuota", () => {
	it("asks for the quotas of the session's account and reads the one in octets", async () => {
		const seen = stubJmap({
			"Quota/get": { list: [octets(1_288_490_188, 5_368_709_120)] },
		});
		expect(await loadQuota(SESSION)).toEqual({
			used: 1_288_490_188,
			limit: 5_368_709_120,
		});
		expect(seen).toHaveLength(1);
		expect(seen[0]?.calls).toEqual([
			["Quota/get", { accountId: "admin", ids: null }, "q"],
		]);
	});

	it("has no limit when the server sends none, or zero", async () => {
		stubJmap({ "Quota/get": { list: [octets(10, null)] } });
		expect(await loadQuota(SESSION)).toEqual({ used: 10, limit: null });
		stubJmap({ "Quota/get": { list: [octets(10, 0)] } });
		expect(await loadQuota(SESSION)).toEqual({ used: 10, limit: null });
		const { limit: _, ...withoutLimit } = octets(10, null);
		stubJmap({ "Quota/get": { list: [withoutLimit] } });
		expect(await loadQuota(SESSION)).toEqual({ used: 10, limit: null });
	});

	it("is null when no quota is counted in octets", async () => {
		stubJmap({ "Quota/get": { list: [] } });
		expect(await loadQuota(SESSION)).toBeNull();
		stubJmap({
			"Quota/get": {
				list: [{ ...octets(3, 9), resourceType: "count" }],
			},
		});
		expect(await loadQuota(SESSION)).toBeNull();
	});

	it("picks the quota in octets among others", async () => {
		stubJmap({
			"Quota/get": {
				list: [
					{ ...octets(3, 9), resourceType: "count" },
					octets(100, 400),
				],
			},
		});
		expect(await loadQuota(SESSION)).toEqual({ used: 100, limit: 400 });
	});

	it("fails on an answer that is not a quota, and on a refusal", async () => {
		stubJmap({
			"Quota/get": { list: [{ resourceType: "octets", used: -1 }] },
		});
		await expect(loadQuota(SESSION)).rejects.toThrow();
		stubJmap({
			"Quota/get": { list: [{ resourceType: "octets", used: "many" }] },
		});
		await expect(loadQuota(SESSION)).rejects.toThrow();
		stubJmap({});
		await expect(loadQuota(SESSION)).rejects.toThrow();
	});
});
