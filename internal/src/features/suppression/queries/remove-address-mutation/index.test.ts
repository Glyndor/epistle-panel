import { describe, expect, it, mock } from "bun:test";
import { MutationObserver, QueryClient } from "@tanstack/react-query";

import { suppressionKeys } from "@/features/suppression/queries/suppression-query";
import type { SuppressionPageView } from "@/features/suppression/schemas/suppression-view";

import { removeAddressMutationOptions } from ".";

const A = "a@example.org";
const B = "b@example.org";
const page: SuppressionPageView = {
	entries: [{ address: A }, { address: B }],
	nextCursor: null,
};

function setup(remove: (address: string) => Promise<unknown>) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	client.setQueryData(suppressionKeys.page(undefined), page);
	const onRemoved = mock(() => {});
	const onFailed = mock(() => {});
	const observer = new MutationObserver(
		client,
		removeAddressMutationOptions({
			client,
			after: undefined,
			remove,
			onRemoved,
			onFailed,
		}),
	);
	return { client, onRemoved, onFailed, observer };
}

const addressesOf = (client: QueryClient) =>
	client
		.getQueryData<SuppressionPageView>(suppressionKeys.page(undefined))
		?.entries.map((e) => e.address);

describe("removeAddressMutationOptions", () => {
	it("takes the row out of the cached page before the server has answered", async () => {
		let release: () => void = () => {};
		const { client, observer } = setup(
			() => new Promise<void>((resolve) => (release = resolve)),
		);

		const done = observer.mutate(A);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(addressesOf(client)).toEqual([B]);
		release();
		await done;
	});

	it("tells the caller, and refetches the list, once the server confirmed", async () => {
		const { client, onRemoved, onFailed, observer } = setup(async () => ({
			removed: A,
		}));
		const invalidated: unknown[] = [];
		const original = client.invalidateQueries.bind(client);
		client.invalidateQueries = ((filters: { queryKey: unknown }) => {
			invalidated.push(filters.queryKey);
			return original(filters as never);
		}) as typeof client.invalidateQueries;

		await observer.mutate(A);

		expect(onRemoved).toHaveBeenCalledTimes(1);
		expect(onFailed).not.toHaveBeenCalled();
		expect(invalidated).toEqual([[...suppressionKeys.all]]);
	});

	it("puts the row back and tells the caller when the server failed", async () => {
		const { client, onRemoved, onFailed, observer } = setup(async () => {
			throw new Error("down");
		});

		await observer.mutate(A).catch(() => {});

		expect(addressesOf(client)).toEqual([A, B]);
		expect(onFailed).toHaveBeenCalledTimes(1);
		expect(onRemoved).not.toHaveBeenCalled();
	});

	it("leaves an uncached page alone", async () => {
		const client = new QueryClient();
		const observer = new MutationObserver(
			client,
			removeAddressMutationOptions({
				client,
				after: B,
				remove: async () => ({}),
				onRemoved: () => {},
				onFailed: () => {},
			}),
		);

		await observer.mutate(A);

		expect(client.getQueryData(suppressionKeys.page(B))).toBeUndefined();
	});
});
