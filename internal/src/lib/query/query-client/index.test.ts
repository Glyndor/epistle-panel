import { describe, expect, it, mock } from "bun:test";

import { ActionError } from "@/lib/query/action-result";

import { GC_TIME_MS, makeQueryClient, STALE_TIME_MS, shouldRetry } from ".";

describe("makeQueryClient", () => {
	it("keeps data fresh for 30 s and cached for 5 minutes", () => {
		const options = makeQueryClient().getDefaultOptions().queries;

		expect(options?.staleTime).toBe(STALE_TIME_MS);
		expect(options?.gcTime).toBe(GC_TIME_MS);
		expect(STALE_TIME_MS).toBe(30_000);
		expect(GC_TIME_MS).toBe(300_000);
	});

	it("reports an ended session once per failing query, and nothing else", async () => {
		const onUnauthenticated = mock(() => {});
		const client = makeQueryClient(onUnauthenticated);

		await client
			.fetchQuery({
				queryKey: ["a"],
				queryFn: () =>
					Promise.reject(new ActionError("unauthenticated")),
				retry: false,
			})
			.catch(() => {});
		await client
			.fetchQuery({
				queryKey: ["b"],
				queryFn: () => Promise.reject(new ActionError("unavailable")),
				retry: false,
			})
			.catch(() => {});

		expect(onUnauthenticated).toHaveBeenCalledTimes(1);
	});
});

describe("shouldRetry", () => {
	it("tries twice more for an ordinary failure and never for an ended session", () => {
		expect(shouldRetry(0, new Error("x"))).toBe(true);
		expect(shouldRetry(1, new ActionError("unavailable"))).toBe(true);
		expect(shouldRetry(2, new Error("x"))).toBe(false);
		expect(shouldRetry(0, new ActionError("unauthenticated"))).toBe(false);
	});
});
