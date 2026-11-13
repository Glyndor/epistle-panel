"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { removeAddressAction } from "@/features/suppression/actions/remove-address";
import { removeAddressMutationOptions } from "@/features/suppression/queries/remove-address-mutation";
import { unwrap } from "@/lib/query/action-result";

/**
 * Remove control for one suppressed address. It confirms first (the server
 * will send to the address again), removes the row at once, and puts it back
 * with an error toast if the server could not do it. The confirmation is an
 * alert dialog (`ConfirmAction`).
 */
export function RemoveAddressButton({
	address,
	after,
}: {
	address: string;
	after: string | undefined;
}) {
	const t = useTranslations("suppression");
	const client = useQueryClient();
	const { mutate, isPending } = useMutation(
		removeAddressMutationOptions({
			client,
			after,
			remove: async (value) =>
				unwrap(await removeAddressAction({ address: value })),
			onRemoved: () => toast.success(t("removed")),
			onFailed: () => toast.error(t("removeError")),
		}),
	);

	return (
		<ConfirmAction
			description={t("confirm", { address })}
			onConfirm={() => mutate(address)}
		>
			<Button
				type="button"
				variant="destructive"
				size="sm"
				disabled={isPending}
				aria-label={t("removeLabel", { address })}
				className="shrink-0"
			>
				{isPending ? t("removing") : t("remove")}
			</Button>
		</ConfirmAction>
	);
}
