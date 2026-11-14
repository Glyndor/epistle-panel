import { mock } from "bun:test";

import type { DeliveryOutcome } from "@/lib/api/schemas";

/** One delivery record as the API sends it, with the fields a chart does not read filled in. */
export function deliveryEntry(
	time: number,
	outcome: DeliveryOutcome,
	index = 0,
) {
	return {
		time,
		spool_id: `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, "0")}`,
		account: "ops",
		from: "ops@example.test",
		recipient: `r${index}@example.net`,
		outcome,
		remote: null,
		reply: null,
		attempt: 1,
		extra: {},
	};
}

/** `count` records of each outcome named, a minute apart going back from `newest`. */
export function deliveryEntries(
	newest: number,
	counts: Partial<Record<DeliveryOutcome, number>>,
) {
	const entries: ReturnType<typeof deliveryEntry>[] = [];
	for (const [outcome, count] of Object.entries(counts)) {
		for (let n = 0; n < count; n += 1) {
			entries.push(
				deliveryEntry(
					newest - entries.length * 60,
					outcome as DeliveryOutcome,
					entries.length,
				),
			);
		}
	}
	return entries;
}

/** What the stubbed API answers on each of the endpoints the overview reads. */
export interface OverviewApi {
	/** The records of the log, or a status for a failure (404 is a log switched off). */
	deliveries?: unknown[] | number;
	/** The queue's pages, in the order the cursor walks them, or a status for a failure. */
	queue?:
		| { id: string; reverse_path?: string; recipients: string[] }[][]
		| number;
	/** The suppression list's pages, in the order the cursor walks them, or a status for a failure. */
	suppression?: string[][] | number;
	/** A status for a failure of the counters; they answer when it is left out. */
	status?: number;
}

const json = (body: unknown, status = 200) =>
	new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});

const refusal = (status: number) =>
	json({ error: { code: "not_found", message: "no" } }, status);

/**
 * Replace global `fetch` with the endpoints the overview reads, each
 * answering what `api` says and an empty list when it says nothing. A page of
 * the queue or the suppression list is found by its cursor, and every page but
 * the last carries the cursor of the next. The stub is a Bun mock, so
 * `sentRequests()` reads what was asked.
 */
export function stubOverviewApi(api: OverviewApi = {}): void {
	globalThis.fetch = mock(async (input: string | URL) => {
		const url = new URL(String(input));
		if (url.pathname === "/api/v1/deliveries") {
			const { deliveries = [] } = api;
			return typeof deliveries === "number"
				? refusal(deliveries)
				: json({ entries: deliveries });
		}
		if (url.pathname === "/api/v1/queue") {
			if (typeof api.queue === "number") {
				return refusal(api.queue);
			}
			const pages = api.queue ?? [[]];
			const cursor = url.searchParams.get("cursor");
			const index = cursor === null ? 0 : Number(cursor.slice(-1));
			const next = index + 1 < pages.length;
			return json({
				entries: (pages[index] ?? []).map((entry) => ({
					reverse_path: "sender@example.test",
					...entry,
				})),
				...(next ? { next_cursor: pageCursor(index + 1) } : {}),
			});
		}
		if (url.pathname === "/api/v1/suppression") {
			if (typeof api.suppression === "number") {
				return refusal(api.suppression);
			}
			const pages = api.suppression ?? [[]];
			const after = url.searchParams.get("after");
			const index = after === null ? 0 : Number(after.split("@")[0]);
			const next = index + 1 < pages.length;
			return json({
				addresses: pages[index] ?? [],
				...(next ? { next_cursor: `${index + 1}@cursor.test` } : {}),
			});
		}
		if (url.pathname === "/api/v1/status") {
			if (api.status !== undefined) {
				return refusal(api.status);
			}
			return json({
				version: "9.9.9",
				domains: 2,
				accounts: 5,
				queue_size: 3,
			});
		}
		return refusal(404);
	}) as unknown as typeof fetch;
}

/** The cursor the stub hands out for page `index` of the queue: a UUID that ends in the index. */
export function pageCursor(index: number): string {
	return `cccccccc-cccc-4ccc-8ccc-00000000000${index}`;
}
