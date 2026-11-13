import { ChartLegend, type LegendItem } from "@/components/charts/chart-legend";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/class-names";

/**
 * The words of a card that are known before its data: they are written into
 * the skeleton, so its title row wraps where the card's will and is as high in
 * every language, at every width and under a finger.
 */
export interface SkeletonWords {
	/** The card's title, shown as it will be. */
	title: string;
	/** The words of the link at the end of the title row. They hold its place and are not shown. */
	action: string;
}

/**
 * A block with the measures of one of the panel's small buttons, around the
 * words the button will carry. The words give it the button's width and are
 * not shown or read: the block is a placeholder, not a control. Its height
 * follows the button's on a coarse pointer, 44 px, with no number written
 * here to drift from it.
 */
function ButtonPlace({
	variant,
	className,
	children,
}: {
	variant: "ghost" | "outline";
	className?: string | undefined;
	children: string;
}) {
	return (
		<span
			data-slot="skeleton"
			aria-hidden="true"
			className={cn(
				buttonVariants({ variant, size: "sm" }),
				"select-none bg-muted text-transparent hover:cursor-default hover:bg-muted hover:text-transparent",
				className,
			)}
		>
			{children}
		</span>
	);
}

/**
 * The frame every chart skeleton shares: a busy card with the title row of the
 * card it stands for. The classes of the row are those of `ChartCard`.
 */
function SkeletonCard({
	words,
	note = false,
	className,
	children,
}: {
	words: SkeletonWords;
	/**
	 * Hold the place of the quiet line under the title: `true` for a short
	 * line, or the words the line will have, give or take a number, for one
	 * long enough to wrap on a phone. The words are not shown or read.
	 */
	note?: boolean | string;
	className?: string | undefined;
	children: React.ReactNode;
}) {
	return (
		<Card
			aria-busy="true"
			data-testid="chart-skeleton"
			className={cn("min-w-0", className)}
		>
			<div className="flex min-w-0 flex-col gap-3">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-0.5">
						<h3 className="font-medium text-sm">{words.title}</h3>
						{typeof note === "string" ? (
							<p
								data-slot="skeleton"
								aria-hidden="true"
								className="w-fit max-w-full select-none rounded-md bg-muted text-transparent text-xs"
							>
								{note}
							</p>
						) : null}
						{note === true ? (
							<Skeleton className="h-4 w-28 rounded-md" />
						) : null}
					</div>
					<ButtonPlace variant="ghost" className="-me-2 -mt-1">
						{words.action}
					</ButtonPlace>
				</div>
				{children}
			</div>
		</Card>
	);
}

const rows = (count: number) =>
	Array.from({ length: count }, (_, row) => `r${row}`);

/** The place of a headline figure: a line of 32 px. */
function FigurePlace() {
	return <Skeleton className="h-8 w-28 rounded-md" />;
}

/**
 * The place of a list of bars: per row a name over a thin bar, 32 px, and
 * 10 px between rows, as `BarList` draws them.
 */
function BarRows({ count }: { count: number }) {
	return (
		<div className="flex flex-col gap-2.5">
			{rows(count).map((row) => (
				<div key={row} className="flex flex-col gap-1">
					<Skeleton className="h-5 w-2/3 rounded-md" />
					<Skeleton className="h-2 w-full rounded-full" />
				</div>
			))}
		</div>
	);
}

/**
 * What holds the place of the outcomes card's content under its title row:
 * the headline figure, the thin bar and the six rows of its table (a header
 * and the five outcomes), flush with the bottom of the card as the table is.
 * A row is as high as a row of the table, 44 px under a finger.
 */
export function OutcomesBodyPlace() {
	return (
		<>
			<FigurePlace />
			<Skeleton className="h-3 w-full rounded-full" />
			<div className="-mb-4 flex flex-col">
				{rows(6).map((row, index) => (
					<div
						key={row}
						className={cn(
							"flex items-center pointer-coarse:h-11",
							index === 0 ? "h-8" : "h-9",
						)}
					>
						<Skeleton className="h-4 w-full rounded-md" />
					</div>
				))}
			</div>
		</>
	);
}

/**
 * The waiting state of the outcomes card, at the height of the card that
 * replaces it: the title row with its line, the headline figure, the thin bar
 * and the six rows of its table (a header and the five outcomes), flush with
 * the bottom of the card as the table is. A row is as high as a row of the
 * table, 44 px under a finger. It is marked busy and says nothing to a screen
 * reader beyond its title; the page's one status line, in the counters'
 * skeleton, names the wait.
 */
export function OutcomesCardSkeleton({
	words,
	className,
}: {
	words: SkeletonWords;
	className?: string | undefined;
}) {
	return (
		<SkeletonCard words={words} note className={className}>
			<OutcomesBodyPlace />
		</SkeletonCard>
	);
}

/**
 * What holds the place of the timeline card's content under its title row:
 * the legend as it will be, the plot with the labels under it, 180 px, and
 * the place of the button.
 */
export function TimelineBodyPlace({
	legend,
	viewData,
}: {
	legend: readonly LegendItem[];
	viewData: string;
}) {
	return (
		<>
			<ChartLegend items={legend} />
			<Skeleton className="h-45 w-full rounded-lg" />
			<ButtonPlace variant="outline" className="self-start">
				{viewData}
			</ButtonPlace>
		</>
	);
}

/**
 * The waiting state of the timeline card: the title row with its line, the
 * legend as it will be (the names of the outcomes are known), the plot with
 * the labels under it, 180 px, and the place of the button under them. The
 * line under the title says the unit and the time of the reading; in some
 * languages it takes two lines on a phone, so its place is held by its own
 * words with a time of four zeros.
 */
export function TimelineCardSkeleton({
	words,
	note,
	legend,
	viewData,
	className,
}: {
	words: SkeletonWords;
	/** The line under the title as it will read, with any time in it. */
	note: string;
	/** The entries of the legend, in the order the chart stacks them. */
	legend: readonly LegendItem[];
	/** The words of the button that shows the table. */
	viewData: string;
	className?: string | undefined;
}) {
	return (
		<SkeletonCard words={words} note={note} className={className}>
			<TimelineBodyPlace legend={legend} viewData={viewData} />
		</SkeletonCard>
	);
}

/**
 * What holds the place of the content of a card that is a list of bars: the
 * headline figure, `rows` rows and the place of the button. The queue card
 * has four rows; the suppression card has a row per domain up to five and
 * one for the rest, so six.
 */
export function BarListBodyPlace({
	rows: count,
	viewData,
}: {
	rows: number;
	viewData: string;
}) {
	return (
		<>
			<FigurePlace />
			<BarRows count={count} />
			<ButtonPlace variant="outline" className="self-start">
				{viewData}
			</ButtonPlace>
		</>
	);
}

/**
 * The waiting state of the queue card: the title row with its line, the
 * headline figure, the four rows of waiting times and the place of the button
 * under them.
 */
export function QueueCardSkeleton({
	words,
	viewData,
	className,
}: {
	words: SkeletonWords;
	viewData: string;
	className?: string | undefined;
}) {
	return (
		<SkeletonCard words={words} note className={className}>
			<BarListBodyPlace rows={4} viewData={viewData} />
		</SkeletonCard>
	);
}

/**
 * The waiting state of the suppression card: the title row, the headline
 * figure, six rows and the place of the button. The card has a row per domain
 * up to five and one for the rest; how many the list has is not known yet, and
 * six is what a list of more than five domains draws.
 */
export function SuppressionCardSkeleton({
	words,
	viewData,
	className,
}: {
	words: SkeletonWords;
	viewData: string;
	className?: string | undefined;
}) {
	return (
		<SkeletonCard words={words} className={className}>
			<BarListBodyPlace rows={6} viewData={viewData} />
		</SkeletonCard>
	);
}
