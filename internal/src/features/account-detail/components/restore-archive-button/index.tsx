"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { restoreArchiveAction } from "@/features/account-detail/actions/restore-archive";
import { accountDetailKeys } from "@/features/account-detail/queries/account-queries";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import { unwrap } from "@/lib/query/action-result";

/**
 * Restore control for one archived message. The server puts it back in the
 * mailbox it was deleted from, or in the inbox when that is gone, and drops it
 * from the archive, so the list is read again whatever the outcome.
 */
export function RestoreArchiveButton({
	name,
	id,
	mailbox,
}: {
	name: string;
	id: string;
	mailbox: string;
}) {
	const t = useTranslations("accountDetail");
	const client = useQueryClient();
	const { mutate, isPending } = useMutation({
		mutationFn: async () =>
			unwrap(await restoreArchiveAction({ name, id })),
		onSuccess: (outcome) =>
			outcome.kind === "done"
				? toast.success(
						t("archiveRestored", {
							mailbox: outcome.value.restoredTo,
						}),
					)
				: toast.error(t("refusedGone")),
		onError: (error) => reportFailure(error, t("unavailable")),
		onSettled: () =>
			client.invalidateQueries({
				queryKey: accountDetailKeys.archive(name),
			}),
	});

	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={isPending}
			aria-label={t("archiveRestoreLabel", { mailbox })}
			onClick={() => mutate()}
		>
			{isPending ? t("archiveRestoring") : t("archiveRestore")}
		</Button>
	);
}
