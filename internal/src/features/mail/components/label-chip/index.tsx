import type * as React from "react";

import type { LabelTone } from "@/features/mail/labels/label-tone";
import type { LabelView } from "@/features/mail/schemas/mail-view";
import { cn } from "@/lib/class-names";

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

/** The pill of a chip, without its height or its width: the list's rows and the reader set their own. */
export const CHIP_PILL =
	"inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 text-foreground text-xs";

/**
 * One label as a chip: a tonal pill with a dot in the label's tone and its
 * name. The name always says the label; the tone only helps the eye find it
 * again. The name is text from a message's keyword, so it is isolated with
 * `<bdi>` and cannot reorder what is beside it. A chip gives way down to four
 * characters of its name and no further: its least width is those, its dot
 * and its padding (1.75rem). A chip that cannot keep that much is one the
 * caller does not draw.
 */
export function LabelChip({
	label,
	className,
	...props
}: { label: LabelView } & React.ComponentProps<"span">) {
	// A name of four characters or fewer is never cut, so its pill is as wide
	// as it; a longer one gives way down to four. One least width for both
	// left a short name in a pill wider than itself.
	const short = Array.from(label.name).length <= 4;

	return (
		<span
			data-slot="label-chip"
			data-tone={label.tone}
			className={cn(
				CHIP_PILL,
				className,
				short ? "shrink-0" : "min-w-[calc(4ch+1.75rem)]",
			)}
			{...props}
		>
			<span
				className={cn(
					"size-2 shrink-0 rounded-full forced-color-adjust-none",
					TONE_DOT[label.tone],
				)}
			/>
			<bdi className="min-w-0 truncate">{label.name}</bdi>
		</span>
	);
}
