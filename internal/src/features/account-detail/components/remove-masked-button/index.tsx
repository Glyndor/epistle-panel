"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { removeMaskedAction } from "@/features/account-detail/actions/remove-masked";
import { accountDetailKeys } from "@/features/account-detail/queries/account-queries";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import { unwrap } from "@/lib/query/action-result";

/**
 * Remove control for one masked address. It confirms first with the browser's
 * own dialog (the action cannot be undone, and a modal Radix dialog would
 * inject the style element the policy refuses), and the list is read again
 * whatever the outcome, so the screen shows what the server holds.
 */
export function RemoveMaskedButton({
	name,
	address,
}: {
	name: string;
	address: string;
}) {
	const t = useTranslations("accountDetail");
	const client = useQueryClient();
	const { mutate, isPending } = useMutation({
		mutationFn: async () =>
			unwrap(await removeMaskedAction({ name, address })),
		onSuccess: (outcome) =>
			outcome.kind === "done"
				? toast.success(t("maskedRemoved"))
				: toast.error(t("refusedGone")),
		onError: (error) => reportFailure(error, t("unavailable")),
		onSettled: () =>
			client.invalidateQueries({
				queryKey: accountDetailKeys.masked(name),
			}),
	});

	return (
		<Button
			type="button"
			variant="destructive"
			size="sm"
			disabled={isPending}
			aria-label={t("maskedRemoveLabel", { address })}
			onClick={() => {
				if (window.confirm(t("maskedRemoveConfirm", { address }))) {
					mutate();
				}
			}}
		>
			{isPending ? t("maskedRemoving") : t("maskedRemove")}
		</Button>
	);
}
