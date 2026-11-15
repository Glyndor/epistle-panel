import { labelKey } from "@/features/mail/labels/keyword-codec";
import {
	encodeLabelName,
	validateLabelName,
} from "@/features/mail/labels/name-codec";
import { compareLabels, labelOf } from "@/features/mail/labels/read-keywords";
import {
	collectSidebarLabels,
	type SeenMessage,
} from "@/features/mail/labels/sidebar-selection";
import type { LabelView } from "@/features/mail/schemas/mail-view";

/** How much of a selection carries a label: all of it, part of it, or none. */
export type Check = "all" | "some" | "none";

/** One row of the "Label as" list: a label and how much of the selection carries it. */
export interface LabelOption {
	readonly label: LabelView;
	readonly check: Check;
}

/**
 * The labels the list offers: the ones seen in the messages the browser has
 * loaded (the sidebar's, at most as many as it lists) and every label the
 * messages being labelled carry, so a label on the message in hand is always
 * there to take off. Two spellings of a keyword are one label, and they come
 * by name.
 */
export function knownLabels(
	pages: readonly (readonly SeenMessage[])[],
	targets: readonly (readonly LabelView[])[],
): LabelView[] {
	const found = new Map<string, LabelView>();
	for (const label of [...collectSidebarLabels(pages), ...targets.flat()]) {
		const key = labelKey(label.keyword);
		if (!found.has(key)) {
			found.set(key, label);
		}
	}
	return [...found.values()].sort(compareLabels);
}

/**
 * What the dialog has known since it opened: `kept` and any label of `current`
 * it did not hold. A label taken off the last message that carried it is on no
 * message and no loaded list any more, and would leave the list at the press
 * that took it off, with no way to put it back; so the list only grows while
 * the dialog is open. The same array comes back when nothing is new.
 */
export function rememberLabels(
	kept: readonly LabelView[],
	current: readonly LabelView[],
): readonly LabelView[] {
	const keys = new Set(kept.map((label) => labelKey(label.keyword)));
	const added = current.filter((label) => !keys.has(labelKey(label.keyword)));
	return added.length === 0 ? kept : [...kept, ...added].sort(compareLabels);
}

/** How much of the targets carry `label`; an empty selection carries none. */
export function checkOf(
	label: LabelView,
	targets: readonly (readonly LabelView[])[],
): Check {
	const key = labelKey(label.keyword);
	const carrying = targets.filter((labels) =>
		labels.some((one) => labelKey(one.keyword) === key),
	).length;
	if (carrying === 0) {
		return "none";
	}
	return carrying === targets.length ? "all" : "some";
}

/**
 * The rows to draw: the known labels whose name holds what was typed (without
 * regard to case or to spaces at its ends), each with how much of the
 * selection carries it.
 */
export function labelOptions(
	known: readonly LabelView[],
	targets: readonly (readonly LabelView[])[],
	typed: string,
): LabelOption[] {
	const wanted = typed.trim().toLowerCase();
	return known
		.filter((label) => label.name.toLowerCase().includes(wanted))
		.map((label) => ({ label, check: checkOf(label, targets) }));
}

/** Whether a label can be made from what was typed, and if not why the list says something about it. */
export type Creation =
	| { readonly kind: "none" }
	| { readonly kind: "ok"; readonly name: string }
	| { readonly kind: "tooLong"; readonly bytes: number };

/**
 * Whether "Create «name»" is offered. The name is exactly what was typed: its
 * spaces and its case are the label's. It is not offered for nothing, for a
 * blank, for a name that is already a label (by exact name; `Work` and `work`
 * are two) or for one that would show as nothing. One over the limit says so
 * with the bytes it takes, since the limit is in UTF-8 bytes and a field can
 * only count characters.
 */
export function creation(typed: string, known: readonly LabelView[]): Creation {
	if (typed.trim() === "") {
		return { kind: "none" };
	}
	if (!validateLabelName(typed)) {
		// What is left to fail, for a nonempty text, is its length in bytes
		// (a lone surrogate cannot be kept at all and is offered nothing).
		return typed.isWellFormed()
			? { kind: "tooLong", bytes: new TextEncoder().encode(typed).length }
			: { kind: "none" };
	}
	if (known.some((label) => label.name === typed)) {
		return { kind: "none" };
	}
	const keyword = encodeLabelName(typed);
	return keyword !== null && labelOf(keyword) !== null
		? { kind: "ok", name: typed }
		: { kind: "none" };
}
