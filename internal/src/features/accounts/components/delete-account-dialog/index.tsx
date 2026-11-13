"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

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
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "@/components/ui/toaster";
import { reportFailure } from "@/features/account-detail/queries/action-feedback";
import { deleteAccountAction } from "@/features/accounts/actions/delete-account";
import { accountsKeys } from "@/features/accounts/queries/accounts-query";
import { QUEUE_CHOICES, type QueueChoice } from "@/lib/api/queue-choices";
import { isOneOf } from "@/lib/is-one-of";
import { ActionError } from "@/lib/query/action-result";

/** Message keys of the two choices for queued mail. */
const CHOICE_LABELS = {
	drain: "queueDrain",
	discard: "queueDiscard",
} as const satisfies Record<QueueChoice, string>;

/**
 * Where the focus goes once an account is deleted. The row that opened the
 * dialog is gone with it, so the focus cannot return there and would fall on
 * the page's body: it goes to the filter field of the table instead, or to
 * the page's heading when no table is drawn. Says whether it found one of the
 * two; when it did not, the dialog's own return of the focus is left alone.
 */
function focusAfterRemoval(): boolean {
	const main = document.getElementById("main-content");
	const field = main?.querySelector<HTMLElement>('input[name="filter"]');
	if (field) {
		field.focus();
		return true;
	}
	const heading = main?.querySelector<HTMLElement>("h1");
	if (heading) {
		heading.tabIndex = -1;
		heading.focus();
		return true;
	}
	return false;
}

/**
 * Asks before an account is deleted, and what to do with the mail it still has
 * queued, a choice the API requires so nothing is dropped by omission. The
 * safe one, letting it be delivered, is chosen to start with. Cancel takes the
 * first focus and Escape closes without acting. The dialog is controlled: the
 * row's menu opens it. When it closes the focus goes back to the control that
 * opened it, or, once the account and its row are gone, to the table's filter
 * field.
 */
export function DeleteAccountDialog({
	name,
	open,
	onOpenChange,
	returnFocus,
}: {
	name: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/**
	 * The control that opened the dialog. The dialog is controlled, so it has
	 * no trigger of its own to give the focus back to when it closes without
	 * deleting; without this the focus would fall on the page's body.
	 */
	returnFocus?: React.RefObject<HTMLElement | null>;
}) {
	const t = useTranslations("accounts");
	const client = useQueryClient();
	const group = useId();
	const [queue, setQueue] = useState<QueueChoice>("drain");
	const [pending, setPending] = useState(false);
	/** Set once the server has deleted the account: the row is about to leave. */
	const removed = useRef(false);

	const remove = async () => {
		setPending(true);
		try {
			const result = await deleteAccountAction({ name, queue });
			if (!result.ok) {
				reportFailure(new ActionError(result.reason), t("unavailable"));
				return;
			}
			removed.current = result.data.kind === "done";
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
			<AlertDialogContent
				// The dialog's own return of the focus has nowhere to go (it
				// looks for a trigger of its own, and this dialog has none),
				// so nothing has to be cancelled here: only a place chosen.
				onCloseAutoFocus={() => {
					if (removed.current && focusAfterRemoval()) {
						return;
					}
					const opener = returnFocus?.current;
					if (opener?.isConnected) {
						opener.focus();
					}
				}}
			>
				<AlertDialogHeader>
					<AlertDialogTitle className="break-all">
						{t("deleteTitle", { name })}
					</AlertDialogTitle>
					<AlertDialogDescription>
						{t("deleteHelp")}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<div className="flex flex-col gap-2">
					<p id={`${group}-legend`} className="font-medium text-sm">
						{t("queueLegend")}
					</p>
					<RadioGroup
						aria-labelledby={`${group}-legend`}
						value={queue}
						onValueChange={(value) => {
							if (isOneOf(QUEUE_CHOICES, value)) {
								setQueue(value);
							}
						}}
					>
						{QUEUE_CHOICES.map((choice) => (
							<div
								key={choice}
								className="flex min-h-8 items-center gap-2 pointer-coarse:min-h-11"
							>
								<RadioGroupItem
									id={`${group}-${choice}`}
									value={choice}
								/>
								<Label
									htmlFor={`${group}-${choice}`}
									className="font-normal"
								>
									{t(CHOICE_LABELS[choice])}
								</Label>
							</div>
						))}
					</RadioGroup>
				</div>
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
