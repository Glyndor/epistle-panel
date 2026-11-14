import { useFormatter, useTranslations } from "next-intl";

import { Tooltip } from "@/components/ui/tooltip";
import type { LabelTone } from "@/features/mail/labels/label-tone";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";

/** How many labels a row shows where it is narrow, and where it is wide. */
const SHOWN_NARROW = 1;
const SHOWN_WIDE = 3;

/**
 * The dot of each tone. Written out, never built from the number: the
 * stylesheet holds only the classes it finds as text in the source, so a
 * class put together at run time would paint nothing and no test here would
 * say so.
 */
const TONE_DOT = {
	1: "bg-label-1",
	2: "bg-label-2",
	3: "bg-label-3",
	4: "bg-label-4",
	5: "bg-label-5",
	6: "bg-label-6",
	7: "bg-label-7",
	8: "bg-label-8",
} as const satisfies Record<LabelTone, string>;

/** A chip: a tonal pill as tall as the line it sits on, so a row with labels is as tall as one without. */
const CHIP =
	"inline-flex h-5 min-w-0 items-center gap-1 rounded-full bg-foreground/10 px-2 text-foreground text-xs";

/** The count of the labels a row has no room for, with their names beside it for the pointer. */
function More({
	names,
	className,
}: {
	names: readonly string[];
	className: string;
}) {
	const t = useTranslations("mail");
	const format = useFormatter();
	if (names.length === 0) {
		return null;
	}
	return (
		<Tooltip
			label={format.list(names, { type: "conjunction" })}
			side="bottom"
			align="end"
		>
			<span
				className={cn(CHIP, "shrink-0", className)}
				data-slot="label-more"
				data-count={names.length}
			>
				{t("moreLabels", { count: names.length })}
			</span>
		</Tooltip>
	);
}

/**
 * The labels of a message as chips after its subject: a tonal pill with a dot
 * in the label's tone and its name. The name always says the label; the tone
 * only helps the eye find it again. A narrow row shows one and a wide one
 * three (the row is the container the `@sm/row` variant asks), and what is
 * left is counted in a last chip, one count for each width, since one number
 * would be wrong in the other. The names behind the count show beside it
 * under the pointer.
 *
 * All of it is hidden from assistive technology: the row says every label in
 * words once, in its state sentence, and would otherwise say the shown ones
 * twice and the rest never.
 */
export function LabelChips({ labels }: { labels: readonly LabelView[] }) {
	if (labels.length === 0) {
		return null;
	}
	const names = labels.map((label) => label.name);

	return (
		<span
			aria-hidden="true"
			data-slot="label-chips"
			className="flex min-w-0 max-w-1/2 items-center gap-1 group-data-[density=compact]/list:hidden group-data-[density=compact]/list:@sm/row:flex"
		>
			{labels.slice(0, SHOWN_WIDE).map((label, index) => (
				<span
					key={label.keyword}
					data-slot="label-chip"
					data-tone={label.tone}
					className={cn(
						CHIP,
						index >= SHOWN_NARROW && "hidden @sm/row:inline-flex",
					)}
				>
					<span
						className={cn(
							"size-2 shrink-0 rounded-full forced-color-adjust-none",
							TONE_DOT[label.tone],
						)}
					/>
					<bdi className="truncate">{label.name}</bdi>
				</span>
			))}
			<More
				names={names.slice(SHOWN_NARROW)}
				className="@sm/row:hidden"
			/>
			<More
				names={names.slice(SHOWN_WIDE)}
				className="hidden @sm/row:inline-flex"
			/>
		</span>
	);
}
