import { describe, expect, it, mock } from "bun:test";
import { MutationObserver, QueryClient } from "@tanstack/react-query";

import { queueKeys } from "@/features/queue/queries/queue-query";
import type { QueueEntryId } from "@/features/queue/schemas/queue-input";
import type { QueuePageView } from "@/features/queue/schemas/queue-view";
import { statusKeys } from "@/features/status/queries/status-query";

import { removeEntryMutationOptions } from ".";

const A = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0a" as QueueEntryId;
const B = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0b" as QueueEntryId;
const page: QueuePageView = {
	entries: [
		{ id: A, from: "a@x", recipients: ["r1"] },
		{ id: B, from: "b@x", recipients: ["r2"] },
	],
	nextCursor: null,
};

function setup(remove: (id: QueueEntryId) => Promise<unknown>) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	client.setQueryData(queueKeys.page(undefined), page);
	client.setQueryData(statusKeys.all, { version: "1" });
	const onRemoved = mock(() => {});
	const onFailed = mock(() => {});
	const observer = new MutationObserver(
		client,
		removeEntryMutationOptions({
			client,
			cursor: undefined,
			remove,
			onRemoved,
			onFailed,
		}),
	);
	return { client, onRemoved, onFailed, observer };
}

const idsOf = (client: QueryClient) =>
	client
		.getQueryData<QueuePageView>(queueKeys.page(undefined))
		?.entries.map((e) => e.id);

describe("removeEntryMutationOptions", () => {
	it("takes the row out of the cached page before the server has answered", async () => {
		let release: () => void = () => {};
		const { client, observer } = setup(
			() => new Promise<void>((resolve) => (release = resolve)),
		);

		const done = observer.mutate(A);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(idsOf(client)).toEqual([B]);
		release();
		await done;
	});

	it("tells the caller, and refetches the queue and the status, once the server confirmed", async () => {
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
		expect(invalidated).toEqual([[...queueKeys.all], [...statusKeys.all]]);
	});

	it("puts the row back and tells the caller when the server failed", async () => {
		const { client, onRemoved, onFailed, observer } = setup(async () => {
			throw new Error("down");
		});

		await observer.mutate(A).catch(() => {});

		expect(idsOf(client)).toEqual([A, B]);
		expect(onFailed).toHaveBeenCalledTimes(1);
		expect(onRemoved).not.toHaveBeenCalled();
	});

	it("leaves an uncached page alone", async () => {
		const client = new QueryClient();
		const observer = new MutationObserver(
			client,
			removeEntryMutationOptions({
				client,
				cursor: B,
				remove: async () => ({}),
				onRemoved: () => {},
				onFailed: () => {},
			}),
		);

		await observer.mutate(A);

		expect(client.getQueryData(queueKeys.page(B))).toBeUndefined();
	});
});
