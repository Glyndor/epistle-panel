import type * as React from "react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/class-names";

/**
 * The frame of one chart: a card that is a `figure`, with a visible title, an
 * optional line under it, an optional link to the page the data lives on, and
 * the chart below. `id` is the root of the ids the parts refer to each other
 * by, so it is unique on the page.
 *
 * Inside go a {@link ChartImage} with the drawing and, outside the image, the
 * same data as a table.
 */
function ChartCard({
	id,
	title,
	note,
	action,
	className,
	children,
}: {
	id: string;
	title: React.ReactNode;
	/** A quiet line under the title: the period, the unit. */
	note?: React.ReactNode;
	/** A link to the page of the data, at the end of the title row. */
	action?: React.ReactNode;
	className?: string | undefined;
	children: React.ReactNode;
}) {
	return (
		<Card data-slot="chart-card" className={cn("min-w-0", className)}>
			<figure
				aria-labelledby={`${id}-title`}
				className="flex min-w-0 flex-col gap-3"
			>
				<figcaption className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 flex-col gap-0.5">
						<h3 id={`${id}-title`} className="font-medium text-sm">
							{title}
						</h3>
						{note ? (
							<p className="text-muted-foreground text-xs">
								{note}
							</p>
						) : null}
					</div>
					{action}
				</figcaption>
				{children}
			</figure>
		</Card>
	);
}

/**
 * The drawing of a chart, as one image to a screen reader: its name is the
 * card's title and its description is `description`, a sentence that says what
 * the drawing shows with its numbers. What is inside is hidden from assistive
 * technology, which is why no link goes in here and why the data is repeated
 * as a table outside. The description is not on screen: the drawing is.
 */
function ChartImage({
	id,
	description,
	className,
	children,
}: {
	/** The `id` of the {@link ChartCard} around it. */
	id: string;
	description: string;
	className?: string | undefined;
	children: React.ReactNode;
}) {
	return (
		<>
			<div
				data-slot="chart-image"
				role="img"
				aria-labelledby={`${id}-title`}
				aria-describedby={`${id}-description`}
				className={cn("min-w-0", className)}
			>
				{children}
			</div>
			<p id={`${id}-description`} hidden>
				{description}
			</p>
		</>
	);
}

/** A caveat about the data of a chart, as a quiet tonal callout with no border. */
function ChartNote({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="chart-note"
			className={cn(
				"rounded-lg bg-surface-sunken px-3 py-2 text-muted-foreground text-xs",
				className,
			)}
			{...props}
		/>
	);
}

/** The headline figure of a chart: one number and the words that say what it counts. */
function ChartFigure({
	value,
	label,
}: {
	value: React.ReactNode;
	label: React.ReactNode;
}) {
	return (
		<p data-slot="chart-figure" className="flex items-baseline gap-1.5">
			<span className="font-semibold text-2xl">{value}</span>
			<span className="text-muted-foreground text-sm">{label}</span>
		</p>
	);
}

export { ChartCard, ChartFigure, ChartImage, ChartNote };
