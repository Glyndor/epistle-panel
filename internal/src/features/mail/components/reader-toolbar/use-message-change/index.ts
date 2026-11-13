"use client";

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
	/** Called when the message left its folder, to take the reader back to the list. */
	onLeft: () => void;
}) {
	const t = useTranslations("mail");
	const client = useQueryClient();

	const mutation = useMutation({
		mutationFn: async ({ change }: { change: Change; quiet?: boolean }) =>
			unwrap(
				await changeMessageAction(
					typeof change === "string"
						? { id, op: change }
						: { id, op: "move", box: change.move },
				),
			),
		onMutate: async ({ change }) => {
			if (typeof change !== "string" || !isKeywordOp(change)) {
				return { undo: () => {} };
			}
			await client.cancelQueries({ queryKey: mailKeys.all });
			return { undo: patchFlags(client, id, change, mailboxId) };
		},
		onError: (_error, { quiet }, context) => {
			context?.undo();
			if (!quiet) {
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
				onLeft();
			} else if (!quiet) {
				toast.success(t("changed"));
			}
		},
		onSettled: () => {
			void client.invalidateQueries({ queryKey: mailKeys.lists });
			void client.invalidateQueries({ queryKey: mailKeys.mailboxes });
		},
	});

	return {
		change: (change: Change, options: { quiet?: boolean } = {}) =>
			mutation.mutate({ change, ...options }),
		pending: mutation.isPending,
	};
}
