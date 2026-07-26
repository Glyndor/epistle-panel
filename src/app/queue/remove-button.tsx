"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { type RemoveState, removeEntry } from "./actions";

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
		<button
			type="submit"
			disabled={pending}
			aria-label={ariaLabel}
			className="shrink-0 rounded-md border border-red-300 px-3 py-1 text-red-700 text-sm hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-50 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-950"
		>
			{pending ? pendingLabel : label}
		</button>
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
			className="flex shrink-0 flex-col items-end gap-1"
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
					className="text-red-700 text-xs dark:text-red-300"
				>
					{t("removeError")}
				</span>
			)}
		</form>
	);
}
