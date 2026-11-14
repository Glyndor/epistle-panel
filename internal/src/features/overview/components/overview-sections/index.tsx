import type * as React from "react";

/** Where a delivery card sits in its grid once the grid has two columns. */
export const CARD_SPAN = {
	outcomes: "@3xl:col-span-2",
	timeline: "@3xl:col-span-3",
} as const;

/**
 * The delivery charts of the overview: their heading, the links that pick the
 * period they cover and, below, the cards. The page puts cards that stream in
 * here and the loading state their skeletons, so the two are the same frame
 * and nothing moves when the data arrives.
 *
 * The grid follows the width of its own container, not of the window: one
 * column in a narrow main area, two from 48rem. Each card is as high as its
 * own content: one that opens its table does not stretch its neighbour into
 * an empty card.
 */
export function DeliveriesSection({
	heading,
	nav,
	children,
}: {
	heading: string;
	/** The period links. */
	nav: React.ReactNode;
	/** The outcomes card and the timeline card, or their skeletons. */
	children: React.ReactNode;
}) {
	return (
		<section
			aria-labelledby="overview-deliveries"
			className="mt-3 flex flex-col gap-2"
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 id="overview-deliveries" className="font-semibold">
					{heading}
				</h2>
				{nav}
			</div>
			<div className="@container">
				<div className="grid items-start gap-3 @3xl:grid-cols-5">
					{children}
				</div>
			</div>
		</section>
	);
}

/**
 * The charts of what the server holds right now, whatever the period: the
 * queue and the suppression list, side by side from 48rem of their container.
 */
export function NowSection({
	heading,
	children,
}: {
	heading: string;
	/** The queue card and the suppression card, or their skeletons. */
	children: React.ReactNode;
}) {
	return (
		<section
			aria-labelledby="overview-now"
			className="mt-3 flex flex-col gap-2"
		>
			<h2 id="overview-now" className="font-semibold">
				{heading}
			</h2>
			<div className="@container">
				<div className="grid items-start gap-3 @3xl:grid-cols-2">
					{children}
				</div>
			</div>
		</section>
	);
}
