import { describe, expect, it } from "bun:test";
import { keepPreviousData } from "@tanstack/react-query";

import {
	SUPPRESSION_REFRESH_MS,
	suppressionKeys,
	suppressionQueryOptions,
} from ".";

describe("suppressionKeys", () => {
	it("keys a page by its cursor, null for the first", () => {
		expect(suppressionKeys.page(undefined)).toEqual([
			"suppression",
			"page",
			null,
		]);
		expect(suppressionKeys.page("a@b.org")).toEqual([
			"suppression",
			"page",
			"a@b.org",
		]);
		expect(suppressionKeys.all).toEqual(["suppression"]);
	});
});

describe("suppressionQueryOptions", () => {
	it("keeps the previous page while the next loads, and polls only while the tab is in view", () => {
		const options = suppressionQueryOptions("a@b.org", async () => ({
			entries: [],
			nextCursor: null,
		}));

		expect(options.placeholderData).toBe(keepPreviousData);
		expect(options.refetchInterval).toBe(SUPPRESSION_REFRESH_MS);
		expect(options.refetchIntervalInBackground).toBe(false);
		expect([...options.queryKey]).toEqual([
			"suppression",
			"page",
			"a@b.org",
		]);
	});

	it("fetches the page of its own cursor", async () => {
		const seen: Array<string | undefined> = [];
		const options = suppressionQueryOptions("a@b.org", async (after) => {
			seen.push(after);
			return { entries: [], nextCursor: null };
		});

		await (options.queryFn as () => Promise<unknown>)();

		expect(seen).toEqual(["a@b.org"]);
	});
});
