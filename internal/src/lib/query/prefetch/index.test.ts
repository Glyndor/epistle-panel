import { describe, expect, it, spyOn } from "bun:test";
import { dehydrate, QueryClient } from "@tanstack/react-query";

import { makeQueryClient } from "@/lib/query/query-client";

import { prefetch } from ".";

describe("prefetch", () => {
	it("puts a successful fetch where the page can dehydrate it", async () => {
		const client = new QueryClient();

		await prefetch(
			client,
			{ queryKey: ["a"], queryFn: async () => 1 },
			"a fetch",
		);

		expect(dehydrate(client).queries.map((q) => q.state.data)).toEqual([1]);
	});

	it("tries once, even when the client retries by default", async () => {
		const client = makeQueryClient();
		const errors = spyOn(console, "error").mockImplementation(() => {});
		let calls = 0;

		await prefetch(
			client,
			{
				queryKey: ["a"],
				queryFn: async () => {
					calls++;
					throw new Error("x");
				},
			},
			"a fetch",
		);

		expect(calls).toBe(1);
		errors.mockRestore();
	});

	it("logs a failure under the operation name, throws nothing, and dehydrates nothing", async () => {
		const client = new QueryClient();
		const errors = spyOn(console, "error").mockImplementation(() => {});

		await prefetch(
			client,
			{
				queryKey: ["a"],
				queryFn: async () => {
					throw new Error("secret");
				},
			},
			"a fetch",
		);

		expect(errors.mock.calls[0]?.[0]).toBe("a fetch failed: error=Error");
		expect(dehydrate(client).queries).toEqual([]);
		errors.mockRestore();
	});
});
