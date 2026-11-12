import { mutationOptions, type QueryClient } from "@tanstack/react-query";

import { queueKeys } from "@/features/queue/queries/queue-query";
import type { QueueEntryId } from "@/features/queue/schemas/queue-input";
import type { QueuePageView } from "@/features/queue/schemas/queue-view";
import { statusKeys } from "@/features/status/queries/status-query";

/** What {@link removeEntryMutationOptions} needs from its caller. */
export interface RemoveEntryDeps {
	client: QueryClient;
	/** Cursor of the page the entry is on; the optimistic update edits that page. */
	cursor: string | undefined;
	/** Remove the entry on the server; throws when it could not. */
	remove: (id: QueueEntryId) => Promise<unknown>;
	/** Runs once the server confirmed, even if the row is long gone from the screen. */
	onRemoved: () => void;
	/** Runs once the server refused or could not be reached, after the rollback. */
	onFailed: () => void;
}

/**
 * Removing a queue entry, optimistically. The row leaves the cached page at
 * once; if the server fails, the page snapshot taken before is put back and the
 * caller is told. Either way the queue and the status counters are refetched, so
 * what is on screen is what the server holds. The callbacks live here, not on
 * `mutate`, because the row (and its button) unmounts as soon as it is removed
 * and `mutate`-level callbacks do not run for an unmounted component.
 */
export function removeEntryMutationOptions({
	client,
	cursor,
	remove,
	onRemoved,
	onFailed,
}: RemoveEntryDeps) {
	const key = queueKeys.page(cursor);
	return mutationOptions({
		mutationFn: (id: QueueEntryId) => remove(id),
		onMutate: async (id) => {
			await client.cancelQueries({ queryKey: queueKeys.all });
			const previous = client.getQueryData<QueuePageView>(key);
			client.setQueryData<QueuePageView>(key, (page) =>
				page
					? {
							...page,
							entries: page.entries.filter(
								(entry) => entry.id !== id,
							),
						}
					: page,
			);
			return { previous };
		},
		onError: (_error, _id, context) => {
			client.setQueryData(key, context?.previous);
			onFailed();
		},
		onSuccess: () => onRemoved(),
		onSettled: async () => {
			await Promise.all([
				client.invalidateQueries({ queryKey: queueKeys.all }),
				client.invalidateQueries({ queryKey: statusKeys.all }),
			]);
		},
	});
}
