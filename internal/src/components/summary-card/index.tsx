import type { GlyphName } from "@/components/glyph";
import { IconTile } from "@/components/icon-tile";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/class-names";

/**
 * One counter of a summary row: the tile, the label and the number. It is one
 * group of a description list, so it sits inside a `dl` and is read as a label
 * with its value; the tile is decoration and is not read. The tile spans the
 * two lines of text and is lower than they are, so the card is as high as it
 * was without it (`SummaryCardSkeleton` holds the same height).
 *
 * `quiet` is a value that could not be read.
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
			className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-0.5 p-3"
		>
			<IconTile name={icon} className="row-span-2" />
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd
				className={cn(
					"font-semibold text-xl tabular-nums",
					quiet && "text-muted-foreground",
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
