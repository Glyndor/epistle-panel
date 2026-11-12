"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
	type RemoveState,
	removeEntry,
} from "@/app/(app)/queue/_actions/remove-entry";
import { Button } from "@/components/ui/button";

function Submit({
	label,
	ariaLabel,
	pendingLabel,
}: {
	label: string;
	ariaLabel: string;
	pendingLabel: string;
}) {
	const { pending } = useFormStatus();
	return (
		<Button
			type="submit"
			variant="destructive"
			disabled={pending}
			aria-label={ariaLabel}
			className="shrink-0"
		>
			{pending ? pendingLabel : label}
		</Button>
	);
}

/**
 * Remove control for one queue entry: confirms before deleting (the action is
 * irreversible), shows a pending state while in flight, and surfaces a failure
 * notice instead of silently leaving the entry in place.
 */
export function RemoveButton({
	id,
	recipients,
}: {
	id: string;
	recipients: string;
}) {
	const t = useTranslations("queue");
	const [state, formAction] = useActionState<RemoveState, FormData>(
		removeEntry,
		null,
	);
	return (
		<form
			action={formAction}
			onSubmit={(event) => {
				if (!window.confirm(t("confirm", { recipients }))) {
					event.preventDefault();
				}
			}}
			className="flex min-w-0 flex-col items-end gap-1"
		>
			<input type="hidden" name="id" value={id} />
			<Submit
				label={t("remove")}
				ariaLabel={t("removeLabel", { recipients })}
				pendingLabel={t("removing")}
			/>
			{state?.ok === false && (
				<span
					role="alert"
					className="text-right text-destructive text-xs"
				>
					{t("removeError")}
				</span>
			)}
		</form>
	);
}
