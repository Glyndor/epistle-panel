"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toaster";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import { deleteAccountAction } from "@/features/accounts/actions/delete-account";
import { accountsKeys } from "@/features/accounts/queries/accounts-query";
import { QUEUE_CHOICES, type QueueChoice } from "@/lib/api/schemas";
import { ActionError } from "@/lib/query/action-result";

/** Message keys of the two choices for queued mail. */
const CHOICE_LABELS = {
	drain: "queueDrain",
	discard: "queueDiscard",
} as const satisfies Record<QueueChoice, string>;

/**
 * Asks before an account is deleted, and what to do with the mail it still has
 * queued, a choice the API requires so nothing is dropped by omission. The
 * safe one, letting it be delivered, is chosen to start with. Cancel takes the
 * first focus and Escape closes without acting. The dialog is controlled: the
 * row's menu opens it.
 */
export function DeleteAccountDialog({
	name,
	open,
	onOpenChange,
}: {
	name: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const t = useTranslations("accounts");
	const client = useQueryClient();
	const group = useId();
	const [queue, setQueue] = useState<QueueChoice>("drain");
	const [pending, setPending] = useState(false);

	const remove = async () => {
		setPending(true);
		try {
			const result = await deleteAccountAction({ name, queue });
			if (!result.ok) {
				reportFailure(new ActionError(result.reason), t("unavailable"));
				return;
			}
			if (result.data.kind !== "done") {
				toast.error(t("deleteGone"));
			} else if (result.data.value.left > 0) {
				toast.success(
					t("deletedLeft", { name, count: result.data.value.left }),
				);
			} else if (result.data.value.discarded > 0) {
				toast.success(
					t("deletedDiscarded", {
						name,
						count: result.data.value.discarded,
					}),
				);
			} else {
				toast.success(t("deleted", { name }));
			}
			await client.invalidateQueries({ queryKey: accountsKeys.all });
		} catch (error) {
			reportFailure(error, t("unavailable"));
		} finally {
			setPending(false);
			onOpenChange(false);
		}
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle className="break-all">
						{t("deleteTitle", { name })}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("deleteHelp")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<fieldset className="flex flex-col gap-2">
					<legend className="mb-2 font-medium text-sm">
						{t("queueLegend")}
					</legend>
					{QUEUE_CHOICES.map((choice) => (
						<label
							key={choice}
							className="flex min-h-8 items-center gap-2 text-sm pointer-coarse:min-h-11"
						>
							<input
								type="radio"
								name={group}
								value={choice}
								checked={queue === choice}
								onChange={() => setQueue(choice)}
								className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
							/>
							{t(CHOICE_LABELS[choice])}
						</label>
					))}
				</fieldset>
				<AlertDialogFooter>
					<AlertDialogCancel>{t("deleteCancel")}</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						disabled={pending}
						aria-busy={pending}
						onClick={(event) => {
							// The dialog stays until the server has answered.
							event.preventDefault();
							void remove();
						}}
					>
						{pending ? t("deleting") : t("deleteConfirm")}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
