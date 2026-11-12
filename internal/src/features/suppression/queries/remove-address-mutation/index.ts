import { mutationOptions, type QueryClient } from "@tanstack/react-query";

import { suppressionKeys } from "@/features/suppression/queries/suppression-query";
import type { SuppressionPageView } from "@/features/suppression/schemas/suppression-view";

/** What {@link removeAddressMutationOptions} needs from its caller. */
export interface RemoveAddressDeps {
	client: QueryClient;
	/** Cursor of the page the address is on; the optimistic update edits that page. */
	after: string | undefined;
	/** Remove the address on the server; throws when it could not. */
	remove: (address: string) => Promise<unknown>;
	/** Runs once the server confirmed, even if the row is long gone from the screen. */
	onRemoved: () => void;
	/** Runs once the server refused or could not be reached, after the rollback. */
	onFailed: () => void;
}

/**
 * Taking an address off the list, optimistically. The row leaves the cached
 * page at once; if the server fails, the snapshot taken before is put back and
 * the caller is told. Either way the list is refetched, so what is on screen is
 * what the server holds. The callbacks live here, not on `mutate`, because the
 * row (and its button) unmounts as soon as it is removed.
 */
export function removeAddressMutationOptions({
	client,
	after,
	remove,
	onRemoved,
	onFailed,
}: RemoveAddressDeps) {
	const key = suppressionKeys.page(after);
	return mutationOptions({
		mutationFn: (address: string) => remove(address),
		onMutate: async (address) => {
			await client.cancelQueries({ queryKey: suppressionKeys.all });
			const previous = client.getQueryData<SuppressionPageView>(key);
			client.setQueryData<SuppressionPageView>(key, (page) =>
				page
					? {
							...page,
							entries: page.entries.filter(
								(entry) => entry.address !== address,
							),
						}
					: page,
			);
			return { previous };
		},
		onError: (_error, _address, context) => {
			client.setQueryData(key, context?.previous);
			onFailed();
		},
		onSuccess: () => onRemoved(),
		onSettled: () =>
			client.invalidateQueries({ queryKey: suppressionKeys.all }),
	});
}
