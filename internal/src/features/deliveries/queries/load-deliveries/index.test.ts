import { afterEach, describe, expect, it } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";

import { loadDeliveries } from ".";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

const record = (n: number, time: number, outcome = "delivered") => ({
	time,
	spool_id: `01890a5d-ac96-774b-b9aa-${String(n).padStart(12, "0")}`,
	account: n % 2 === 0 ? "alice" : null,
	from: "a@example.org",
	recipient: `r${n}@example.net`,
	outcome,
	remote: null,
	reply: null,
	attempt: 1,
	extra: {},
});

describe("loadDeliveries", () => {
	it("sorts the records newest first, whatever order the API used", async () => {
		stubFetchJson({
			entries: [record(1, 100), record(2, 300), record(3, 200)],
		});

		const view = await loadDeliveries({});

		expect(view.entries.map((e) => e.time)).toEqual([300, 200, 100]);
		expect(view.logDisabled).toBe(false);
		expect(view.full).toBe(false);
	});

	it("gives every row its own id even when a message has several records", async () => {
		stubFetchJson({ entries: [record(1, 100), record(1, 100)] });

		const ids = (await loadDeliveries({})).entries.map((e) => e.id);

		expect(new Set(ids).size).toBe(2);
	});

	it("asks for the limit of 100 and the filters it was given, and nothing else", async () => {
		stubFetchJson({ entries: [] });
		await loadDeliveries({
			outcome: "failed",
			since: "24h",
			recipient: "a+b@x.org",
		});
		await loadDeliveries({});

		const [filtered, plain] = sentRequests();
		expect(filtered?.url).toEndWith(
			"/api/v1/deliveries?outcome=failed&since=24h&recipient=a%2Bb%40x.org&limit=100",
		);
		expect(plain?.url).toEndWith("/api/v1/deliveries?limit=100");
		expect(filtered?.method).toBe("GET");
	});

	it("says the page is full at 100 records, and not at 99", async () => {
		stubFetchJson({
			entries: Array.from({ length: 99 }, (_, i) => record(i, i)),
		});
		expect((await loadDeliveries({})).full).toBe(false);
		stubFetchJson({
			entries: Array.from({ length: 100 }, (_, i) => record(i, i)),
		});
		expect((await loadDeliveries({})).full).toBe(true);
	});

	it("reports a switched-off log (404) as a state, not a failure", async () => {
		stubFetchJson(
			{
				error: {
					code: "not_found",
					message: "the delivery log is disabled",
				},
			},
			404,
		);

		expect(await loadDeliveries({})).toEqual({
			entries: [],
			logDisabled: true,
			full: false,
		});
	});

	it("lets any other API error through", async () => {
		stubFetchJson({ error: { code: "internal", message: "x" } }, 500);

		await expect(loadDeliveries({})).rejects.toThrow();
	});
});
