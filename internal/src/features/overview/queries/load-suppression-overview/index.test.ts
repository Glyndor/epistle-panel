import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { stubOverviewApi } from "@/features/overview/test-support/api";
import { sentRequests, stubFetchReject } from "@/lib/api/test-support/fetch";

import { loadSuppressionOverview } from ".";

const originalFetch = globalThis.fetch;
const queries = () =>
	sentRequests().map((request) => new URL(request.url).search);

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("loadSuppressionOverview", () => {
	it("reads a short list in one call of 100 and counts it by domain", async () => {
		stubOverviewApi({
			suppression: [["a@example.net", "b@example.net", "c@example.org"]],
		});

		const overview = await loadSuppressionOverview();

		expect(queries()).toEqual(["?limit=100"]);
		if (overview.kind !== "data") {
			throw new Error(`expected data, got ${overview.kind}`);
		}
		expect(overview.capped).toBe(false);
		expect(overview.domains.total).toBe(3);
		expect(
			overview.domains.rows.map((row) => [row.domain, row.count]),
		).toEqual([
			["example.net", 2],
			["example.org", 1],
		]);
	});

	it("follows the cursor, percent-encoded, to the last page", async () => {
		stubOverviewApi({
			suppression: [["a@x.test"], ["b@x.test"], ["c@x.test"]],
		});

		const overview = await loadSuppressionOverview();

		expect(queries()).toEqual([
			"?limit=100",
			"?limit=100&after=1%40cursor.test",
			"?limit=100&after=2%40cursor.test",
		]);
		expect(overview.kind === "data" && overview.domains.total).toBe(3);
	});

	it("stops after five pages and says the list holds more", async () => {
		stubOverviewApi({
			suppression: Array.from({ length: 8 }, (_, n) => [`u${n}@x.test`]),
		});

		const overview = await loadSuppressionOverview();

		expect(sentRequests()).toHaveLength(5);
		expect(overview).toMatchObject({ kind: "data", capped: true });
		expect(overview.kind === "data" && overview.domains.total).toBe(5);
	});

	it("is not capped when the fifth page is the last", async () => {
		stubOverviewApi({
			suppression: Array.from({ length: 5 }, (_, n) => [`u${n}@x.test`]),
		});

		expect(await loadSuppressionOverview()).toMatchObject({
			kind: "data",
			capped: false,
		});
	});

	it("answers unreachable and logs a fixed name when the API cannot be reached", async () => {
		const log = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const overview = await loadSuppressionOverview();

		expect(overview).toEqual({ kind: "unreachable" });
		expect(String(log.mock.calls[0]?.[0])).toStartWith(
			"overview suppression failed:",
		);
		log.mockRestore();
	});
});
