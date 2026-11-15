import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { toast } from "@/components/ui/toaster";
import { labelMessagesAction } from "@/features/mail/actions/label-messages";
import { encodeLabelName } from "@/features/mail/labels/name-codec";
import { labelOf } from "@/features/mail/labels/read-keywords";
import { patchLabels } from "@/features/mail/queries/label-cache";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import {
	isGone,
	type OptimisticWrite,
} from "@/features/mail/queries/message-cache";
import { LABEL_BATCH } from "@/features/mail/schemas/label-input-model";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import { unwrap } from "@/lib/query/action-result";

/** What one call asks for: the messages, the label and whether it goes on or off, and the typed name when the label is a new one. */
interface Ask {
	readonly ids: readonly string[];
	readonly label: LabelView;
	readonly on: boolean;
	/** The name the label is made from, the first time it is put on a message. */
	readonly name?: string;
}

/** How the messages ended: the ones the server changed, the ones it did not, and the ones that left their folder first. */
interface Ended {
	readonly updated: readonly string[];
	readonly failed: readonly string[];
	readonly skipped: readonly string[];
}

/** `list` in runs of at most `size`. */
function chunks<T>(list: readonly T[], size: number): T[][] {
	const runs: T[][] = [];
	for (let at = 0; at < list.length; at += size) {
		runs.push(list.slice(at, at + size));
	}
	return runs;
}

/**
 * Changes of the labels of messages: put a label on, take it off, or make one
 * from a name and put it on. It shows at once on the open message and on the
 * rows and is put back, for the messages the server did not change, when it
 * answers; a failure says so with a toast, and a change that worked says
 * nothing: the chips and the checks already show it.
 *
 * A selection longer than {@link LABEL_BATCH} is sent in runs of that size, one
 * after the other, so no request is unbounded; a run that fails leaves the
 * others written, and only the messages of the failed run are put back.
 *
 * `scope` serialises the changes: the server replaces a message's whole keyword
 * set, so two changes written at once would each be built from the set before
 * the other. For one message give `mailKeys.change(id).join(":")`, the scope its
 * flags use, so a label and a star on it wait for each other too; for a
 * selection give a scope of its own.
 */
export function useLabelChange(scope: string) {
	const t = useTranslations("mail");
	const client = useQueryClient();

	const mutation = useMutation({
		mutationKey: [...mailKeys.changes, "labels"],
		scope: { id: scope },
		mutationFn: async (ask: Ask): Promise<Ended> => {
			// A change that waited behind a move: the message has another id
			// now, and writing to the old one can only fail.
			const live = ask.ids.filter((id) => !isGone(client, id));
			const skipped = ask.ids.filter((id) => isGone(client, id));
			const updated: string[] = [];
			const failed: string[] = [];
			let error: unknown;
			let answered = 0;
			for (const run of chunks(live, LABEL_BATCH)) {
				try {
					const outcome = unwrap(
						await labelMessagesAction(
							ask.name === undefined
								? {
										kind: "keyword",
										ids: run,
										keyword: ask.label.keyword,
										on: ask.on,
									}
								: { kind: "create", ids: run, name: ask.name },
						),
					);
					answered += 1;
					updated.push(...outcome.updated);
					failed.push(...outcome.failed);
				} catch (caught) {
					error ??= caught;
					failed.push(...run);
				}
			}
			if (answered === 0 && error !== undefined) {
				throw error;
			}
			return { updated, failed, skipped };
		},
		// Runs when the change is asked for, before its turn comes: a change
		// that waits already shows.
		onMutate: async (ask) => {
			await client.cancelQueries({ queryKey: mailKeys.all });
			return {
				writes: patchLabels(client, ask.ids, ask.label, ask.on),
			};
		},
		onError: (_error, _ask, context) => {
			for (const write of context?.writes.values() ?? []) {
				write.refuse();
			}
			toast.error(t("actionFailed"));
		},
		onSuccess: (ended, ask, context) => {
			const end = (
				ids: readonly string[],
				how: keyof OptimisticWrite,
			) => {
				for (const id of ids) {
					context?.writes.get(id)?.[how]();
				}
			};
			end(ended.updated, "confirm");
			end(ended.failed, "refuse");
			end(ended.skipped, "drop");
			if (ended.failed.length > 0) {
				toast.error(
					ask.ids.length === 1
						? t("actionFailed")
						: t("labelsFailedSome", { count: ended.failed.length }),
				);
			}
		},
		onSettled: () => {
			// While a change to any message waits, what the server holds is
			// not yet what the screen shows: reading it now would take the
			// waiting change off the screen until its own answer. The last
			// one to be answered counts only itself, so the lists are always
			// read in the end.
			if (client.isMutating({ mutationKey: mailKeys.changes }) > 1) {
				return;
			}
			void client.invalidateQueries({ queryKey: mailKeys.lists });
		},
	});

	return {
		/** Put an existing label on the messages, or take it off: by its keyword, which is its identity. */
		apply: (ids: readonly string[], label: LabelView, on: boolean) =>
			mutation.mutate({ ids, label, on }),
		/**
		 * Make a label from a typed name and put it on the messages. `false`,
		 * and nothing asked, when the name is not one the shared rule takes.
		 */
		create: (ids: readonly string[], name: string): boolean => {
			const keyword = encodeLabelName(name);
			const label = keyword === null ? null : labelOf(keyword);
			if (label === null) {
				return false;
			}
			mutation.mutate({ ids, label, on: true, name });
			return true;
		},
		/** A change asked for from here has not been answered yet. */
		pending: mutation.isPending,
	};
}
