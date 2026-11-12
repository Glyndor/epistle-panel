"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { removeEntryAction } from "@/features/queue/actions/remove-entry";
import { removeEntryMutationOptions } from "@/features/queue/queries/remove-entry-mutation";
import type { QueueEntryId } from "@/features/queue/schemas/queue-input";
import { unwrap } from "@/lib/query/action-result";

/**
 * Remove control for one queue entry. It confirms first (the action cannot be
 * undone), removes the row at once, and puts it back with an error toast if the
 * server could not do it. The confirmation is the browser's own dialog: a Radix
 * alert dialog locks page scroll by injecting a style element the CSP refuses.
 */
export function RemoveEntryButton({
	id,
	recipients,
	cursor,
}: {
	id: QueueEntryId;
	/** The recipients, joined, for the confirmation and the accessible name. */
	recipients: string;
	cursor: string | undefined;
}) {
	const t = useTranslations("queue");
	const client = useQueryClient();
	const { mutate, isPending } = useMutation(
		removeEntryMutationOptions({
			client,
			cursor,
			remove: async (entryId) =>
				unwrap(await removeEntryAction({ id: entryId })),
			onRemoved: () => toast.success(t("removed")),
			onFailed: () => toast.error(t("removeError")),
		}),
	);

	return (
		<Button
			type="button"
			variant="destructive"
			size="sm"
			disabled={isPending}
			aria-label={t("removeLabel", { recipients })}
			className="shrink-0"
			onClick={() => {
				if (window.confirm(t("confirm", { recipients }))) {
					mutate(id);
				}
			}}
		>
			{isPending ? t("removing") : t("remove")}
		</Button>
	);
}
