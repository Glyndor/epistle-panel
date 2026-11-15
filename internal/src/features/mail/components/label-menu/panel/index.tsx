"use client";

import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionRow } from "@/features/mail/components/label-menu/option-row";
import { useListKeys } from "@/features/mail/components/label-menu/panel/use-list-keys";
import { useLabelChange } from "@/features/mail/components/label-menu/use-label-change";
import { useLoadedMail } from "@/features/mail/components/labels-nav/use-loaded-mail";
import {
	creation,
	knownLabels,
	type LabelOption,
	labelOptions,
	rememberLabels,
} from "@/features/mail/labels/label-options";
import { LABEL_NAME_MAX } from "@/features/mail/labels/name-codec";
import { mailKeys } from "@/features/mail/queries/mail-query-keys";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import { fieldLength } from "@/lib/field-length";

/** A message being labelled and the labels it carries now. */
export interface LabelTarget {
	readonly id: string;
	readonly labels: readonly LabelView[];
}

/**
 * The content of "Label as": a field that finds a label or names a new one, a
 * tick box for each label known and, last, "Create «text»" when what is typed
 * is no label yet. It works on one message or on a selection: the box of a
 * label is ticked when all of them carry it, indeterminate when some do.
 *
 * What is typed is checked three times, with the one rule (`name-codec`): the
 * field's `maxlength` stops it one character over the limit, so a paste that
 * was cut is still seen to be too long and says so; this panel offers no
 * creation for a name the rule would refuse; and the action checks it again.
 * Enter in the field makes the label when one is offered, and otherwise
 * presses the one label left when the text narrows the list to it.
 *
 * Nothing closes the dialog but the dialog: a press changes the labels and
 * the list stays, so several can be changed in one visit.
 */
export function LabelPanel({ targets }: { targets: readonly LabelTarget[] }) {
	const t = useTranslations("mail");
	const [typed, setTyped] = useState("");
	const { pages } = useLoadedMail();
	const ids = useMemo(() => targets.map((target) => target.id), [targets]);
	const sets = useMemo(
		() => targets.map((target) => target.labels),
		[targets],
	);
	const current = useMemo(() => knownLabels(pages, sets), [pages, sets]);
	// The list only grows while the dialog is open: a label taken off the last
	// message that carried it must stay, to be put back.
	const [kept, setKept] = useState<readonly LabelView[]>([]);
	useEffect(
		() => setKept((before) => rememberLabels(before, current)),
		[current],
	);
	const known = useMemo(() => rememberLabels(kept, current), [kept, current]);
	const options = useMemo(
		() => labelOptions(known, sets, typed),
		[known, sets, typed],
	);
	const offer = creation(typed, known);
	const { apply, create } = useLabelChange(
		ids.length === 1 && ids[0] !== undefined
			? mailKeys.change(ids[0]).join(":")
			: "mail:change:labels",
	);

	const hint = useId();
	const problem = useId();
	const list = useRef<HTMLFieldSetElement>(null);
	const field = useRef<HTMLInputElement>(null);
	const { onListKeyDown, onFieldArrow } = useListKeys(list, field);

	const toggle = ({ label, check }: LabelOption) =>
		apply(ids, label, check !== "all");
	const make = (name: string) => {
		if (create(ids, name)) {
			setTyped("");
			field.current?.focus();
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<Input
				ref={field}
				value={typed}
				maxLength={fieldLength(LABEL_NAME_MAX)}
				autoComplete="off"
				spellCheck={false}
				aria-label={t("labelSearch")}
				aria-describedby={`${hint} ${problem}`}
				aria-invalid={offer.kind === "tooLong" ? true : undefined}
				placeholder={t("labelSearch")}
				onChange={(event) => setTyped(event.target.value)}
				onKeyDown={(event) => {
					if (onFieldArrow(event) || event.key !== "Enter") {
						return;
					}
					event.preventDefault();
					if (offer.kind === "ok") {
						make(offer.name);
					} else if (options.length === 1 && options[0]) {
						toggle(options[0]);
					}
				}}
			/>
			<p id={hint} className="text-muted-foreground text-xs">
				{t("labelSearchHint", { count: LABEL_NAME_MAX })}
			</p>
			<p
				id={problem}
				aria-live="polite"
				className="text-destructive text-xs empty:hidden"
			>
				{offer.kind === "tooLong"
					? t("labelTooLong", {
							bytes: offer.bytes,
							max: LABEL_NAME_MAX,
						})
					: null}
			</p>
			<fieldset
				ref={list}
				onKeyDown={onListKeyDown}
				className="-mx-1 flex max-h-64 min-w-0 flex-col gap-1 overflow-y-auto px-1"
			>
				<legend className="sr-only">{t("labelsTitle")}</legend>
				{options.length === 0 && offer.kind !== "ok" ? (
					<p className="px-2 py-1.5 text-muted-foreground text-sm">
						{t("labelNoMatch")}
					</p>
				) : null}
				<ul className="flex flex-col">
					{options.map((option, index) => (
						<OptionRow
							key={option.label.keyword}
							option={option}
							tabbable={index === 0}
							onToggle={toggle}
						/>
					))}
				</ul>
				{offer.kind === "ok" ? (
					<Button
						type="button"
						variant="ghost"
						data-label-control=""
						className="justify-start"
						onClick={() => make(offer.name)}
					>
						<PlusIcon aria-hidden="true" />
						{t.rich("labelCreate", {
							name: () => (
								<bdi className="truncate">{offer.name}</bdi>
							),
						})}
					</Button>
				) : null}
			</fieldset>
		</div>
	);
}
