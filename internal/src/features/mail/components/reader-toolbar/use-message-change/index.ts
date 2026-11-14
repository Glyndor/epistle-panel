import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { toast } from "@/components/ui/toaster";
import { changeMessageAction } from "@/features/mail/actions/change-message";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import { isKeywordOp, patchFlags } from "@/features/mail/queries/message-cache";
import type { MessageOp } from "@/features/mail/schemas/mail-input";
import { unwrap } from "@/lib/query/action-result";

/** One change: an operation, or a move to a named folder. */
export type Change = MessageOp | { readonly move: string };

/** How much of a change's outcome is told with a toast: nothing, or only a failure. */
type Quiet = boolean | "success";

/** What one call asks for. */
interface Asked {
	change: Change;
	quiet?: Quiet;
}

/**
 * Changes of one open message. A flag change shows at once on the message, its
 * row and the folder counter and is put back if the server refuses; a change
 * that takes the message out of its folder (archive, trash, spam, move) waits
 * for the server, then reloads the list and the counters and calls `onLeft` to go back
 * to the list, because epistle gives a moved message a new id. `quiet` is for the
 * read mark made by opening a message, which says nothing.
 */
export function useMessageChange({
	id,
	mailboxId,
	onLeft,
}: {
	id: string;
	mailboxId: string | null;
	/** Called when the message left its folder, to take the reader back to the list. A caller that only changes flags gives none. */
	onLeft?: () => void;
}) {
	const t = useTranslations("mail");
	const client = useQueryClient();

	const mutation = useMutation({
		mutationKey: mailKeys.change(id),
		// One change to a message at a time, in the order they were asked for.
		// The server replaces a message's whole keyword set, so two changes
		// written at once would each be built from the set before the other:
		// the next one starts when the one before has been answered.
		scope: { id: mailKeys.change(id).join(":") },
		mutationFn: async ({ change }: Asked) =>
			unwrap(
				await changeMessageAction(
					typeof change === "string"
						? { id, op: change }
						: { id, op: "move", box: change.move },
				),
			),
		// Runs when the change is asked for, before its turn comes: a change
		// that waits already shows.
		onMutate: async ({ change }) => {
			if (typeof change !== "string" || !isKeywordOp(change)) {
				return { undo: undefined };
			}
			await client.cancelQueries({ queryKey: mailKeys.all });
			return { undo: patchFlags(client, id, change, mailboxId) };
		},
		onError: (_error, { quiet }, context) => {
			context?.undo?.();
			if (quiet !== true) {
				toast.error(t("actionFailed"));
			}
		},
		onSuccess: (result, { quiet }) => {
			if (result.kind === "noFolder") {
				toast.error(t("noFolder"));
				return;
			}
			if (result.outcome.left) {
				client.removeQueries({ queryKey: mailKeys.message(id) });
				toast.success(
					result.outcome.destroyed ? t("deletedForever") : t("moved"),
				);
				onLeft?.();
			} else if (quiet === undefined || quiet === false) {
				toast.success(t("changed"));
			}
		},
		onSettled: () => {
			// While another change to this message waits, what the server
			// holds is not yet what the screen shows: reading it now would
			// take the waiting change off the screen until its own answer.
			if (client.isMutating({ mutationKey: mailKeys.change(id) }) > 1) {
				return;
			}
			void client.invalidateQueries({ queryKey: mailKeys.lists });
			void client.invalidateQueries({ queryKey: mailKeys.mailboxes });
		},
	});

	return {
		/**
		 * Ask for one change. It shows at once and is written in its turn.
		 * `quiet` says how much the outcome is told: `true` nothing at all
		 * (the read mark of opening a message), `"success"` only a failure (a
		 * mark set from a row, which already shows the change).
		 */
		change: (change: Change, options: { quiet?: Quiet } = {}) =>
			mutation.mutate({ change, ...options }),
		/** A change to this message, asked for from here, has not been answered yet. */
		pending: mutation.isPending,
	};
}
