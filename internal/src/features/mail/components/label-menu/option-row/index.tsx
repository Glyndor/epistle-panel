"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { LabelChip } from "@/features/mail/components/label-chip";
import type { LabelOption } from "@/features/mail/labels/label-options";
import { cn } from "@/lib/class-names";

/**
 * One label of the "Label as" list: a tick box and the label as its chip. The
 * box is ticked when every message carries the label, empty when none does and
 * indeterminate when some do; a press on it puts the label on all of them,
 * unless all carry it, which takes it off all of them. The row is the label's
 * 24 px (44 px on a coarse pointer) press target, as the other tick boxes of
 * the panel are.
 *
 * The box is one stop of the keyboard for the whole list: the first row holds
 * it and the arrow keys (handled by the panel) move between the rest. The
 * chip carries the name, so the box's accessible name is the label's name and
 * nothing is said twice.
 */
export function OptionRow({
	option,
	tabbable,
	onToggle,
}: {
	option: LabelOption;
	/** Whether the box is a stop of the Tab key: one box of the list is. */
	tabbable: boolean;
	onToggle: (option: LabelOption) => void;
}) {
	const { label, check } = option;
	const id = `label-option-${label.keyword}`;

	return (
		<li data-slot="label-option" data-check={check}>
			<Label
				htmlFor={id}
				className={cn(
					"min-h-8 gap-3 rounded-lg px-2 font-normal hover:bg-surface-sunken active:bg-accent/70 pointer-coarse:min-h-11",
				)}
			>
				<Checkbox
					id={id}
					data-label-control=""
					checked={check === "all"}
					tabIndex={tabbable ? 0 : -1}
					// Set on every render: the browser clears it on a press, and
					// whether it is shown is the selection's, not the press's.
					ref={(box) => {
						if (box) {
							box.indeterminate = check === "some";
						}
					}}
					onChange={() => onToggle(option)}
				/>
				<LabelChip label={label} className="h-6 max-w-full" />
			</Label>
		</li>
	);
}
