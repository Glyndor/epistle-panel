import { describe, expect, it } from "bun:test";
import { keepPreviousData } from "@tanstack/react-query";

import { QUEUE_REFRESH_MS, queueKeys, queueQueryOptions } from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

describe("queueKeys", () => {
	it("keys a page by its cursor, null for the first", () => {
		expect(queueKeys.page(undefined)).toEqual(["queue", "page", null]);
		expect(queueKeys.page(ID)).toEqual(["queue", "page", ID]);
		expect(queueKeys.all).toEqual(["queue"]);
	});
});

describe("queueQueryOptions", () => {
	it("keeps the previous page while the next loads, and polls only while the tab is in view", () => {
		const options = queueQueryOptions(ID, async () => ({
			entries: [],
			nextCursor: null,
		}));

		expect(options.placeholderData).toBe(keepPreviousData);
		expect(options.refetchInterval).toBe(QUEUE_REFRESH_MS);
		expect(options.refetchIntervalInBackground).toBe(false);
		expect([...options.queryKey]).toEqual(["queue", "page", ID]);
	});

	it("fetches the page of its own cursor", async () => {
		const seen: Array<string | undefined> = [];
		const options = queueQueryOptions(ID, async (cursor) => {
			seen.push(cursor);
			return { entries: [], nextCursor: null };
		});

		await (options.queryFn as () => Promise<unknown>)();

		expect(seen).toEqual([ID]);
	});
});
