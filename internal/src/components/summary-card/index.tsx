import type { GlyphName } from "@/components/glyph";
import { IconTile } from "@/components/icon-tile";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/class-names";
import { FORCED_POINTER } from "@/lib/pointer-states";

/**
 * One counter of a summary row: the tile, the label and the number. It is one
 * group of a description list, so it sits inside a `dl` and is read as a label
 * with its value; the tile is decoration and is not read. The tile spans the
 * two lines of text and is lower than they are, so the card is as high as it
 * was without it (`SummaryCardSkeleton` holds the same height).
 *
 * `quiet` is a value that could not be read.
 *
 * It is a readout and takes no press, but it answers the pointer like the
 * rows of a table do: it fills with the hover tone and one step deeper while
 * pressed. The tile would vanish into that fill (both are tones of the same
 * grey), so it takes the card's own tone while the card is filled, and the
 * words go to the foreground, since the muted tone of a label is not 4.5:1 on
 * the press fill in the dark theme.
 */
export function SummaryCard({
	icon,
	label,
	value,
	quiet = false,
}: {
	icon: GlyphName;
	label: string;
	value: string;
	quiet?: boolean;
}) {
	return (
		<Card
			data-slot="summary-card"
			className={cn(
				"group/summary grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 p-3 transition-colors hover:bg-accent active:bg-accent-press",
				FORCED_POINTER,
			)}
		>
			<IconTile
				name={icon}
				className="row-span-2 group-hover/summary:bg-card"
			/>
			<dt className="text-muted-foreground text-xs group-hover/summary:text-accent-foreground">
				{label}
			</dt>
			<dd
				className={cn(
					"font-semibold text-xl tabular-nums",
					quiet &&
						"text-muted-foreground group-hover/summary:text-accent-foreground",
				)}
			>
				{value}
			</dd>
		</Card>
	);
}

/** The waiting state of one counter: the same card, with a bar where each part will be. */
export function SummaryCardSkeleton() {
	return (
		<Card
			aria-hidden="true"
			className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 p-3"
		>
			<Skeleton className="row-span-2 size-9 rounded-lg" />
			<Skeleton className="h-4 w-16 rounded-md" />
			<Skeleton className="h-7 w-12 rounded-md" />
		</Card>
	);
}
