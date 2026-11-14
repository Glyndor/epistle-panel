import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";

/**
 * A message in the place of a chart, at the height the chart would have.
 * `place` is what holds the place of the card's content while it loads (a
 * `...BodyPlace` of `chart-card-skeleton`): it is laid out unseen and unread,
 * and the message is centred over it. So a card with nothing to draw is as
 * high as its skeleton was, in every language and width and under a finger,
 * and the page does not move when it arrives.
 */
function InPlace({
	place,
	children,
}: {
	place: React.ReactNode;
	children: React.ReactNode;
}) {
	if (place === undefined) {
		return children;
	}
	return (
		<div data-slot="chart-state" className="grid min-w-0">
			<div
				aria-hidden="true"
				className="invisible col-start-1 row-start-1 flex min-w-0 flex-col gap-3"
			>
				{place}
			</div>
			<div className="col-start-1 row-start-1 flex min-w-0 items-center justify-center">
				{children}
			</div>
		</div>
	);
}

/**
 * What a chart card shows when the API did not answer for it: that it was not
 * loaded and where the way out is. It is not a warning of its own. The page
 * gives one, at the top, with the link to try again (`OverviewNotice`); five
 * cards each repeating it would be five alerts for one fault.
 */
export function CardUnavailable({
	title,
	description,
	place,
}: {
	title: string;
	description: string;
	/** What holds the place of the card's content while it loads; the message takes its height. */
	place?: React.ReactNode;
}) {
	return (
		<InPlace place={place}>
			<Empty className="p-4" data-state="unavailable">
				<EmptyHeader>
					<EmptyTitle>{title}</EmptyTitle>
					<EmptyDescription>{description}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</InPlace>
	);
}

/**
 * What a chart card shows when there is nothing to draw: what is missing and
 * what to do about it, in place of an empty chart.
 */
export function CardEmpty({
	title,
	description,
	place,
}: {
	title: string;
	description: string;
	/** What holds the place of the card's content while it loads; the message takes its height. */
	place?: React.ReactNode;
}) {
	return (
		<InPlace place={place}>
			<Empty className="p-4">
				<EmptyHeader>
					<EmptyTitle>{title}</EmptyTitle>
					<EmptyDescription>{description}</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</InPlace>
	);
}
