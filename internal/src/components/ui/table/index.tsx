import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * A semantic table in a container that scrolls sideways when the columns do
 * not fit, so an action column is never clipped on a narrow screen. No line
 * separates the rows: the body stripes every second row with the sunken
 * surface and tints the row under the pointer.
 *
 * A table with nothing to focus inside (no link, no button) cannot be scrolled
 * from the keyboard. Give such a table a `scrollLabel`: the container then
 * takes the focus, with the ring, and is a group named by the label.
 */
function Table({
	className,
	scrollLabel,
	...props
}: React.ComponentProps<"table"> & {
	/** Names the scrolling container and puts it in the tab order. */
	scrollLabel?: string | undefined;
}) {
	return (
		<div
			data-slot="table-container"
			className="relative w-full overflow-x-auto rounded-xl bg-card focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
			{...(scrollLabel === undefined
				? {}
				: { role: "group", "aria-label": scrollLabel, tabIndex: 0 })}
		>
			<table
				data-slot="table"
				className={cn("w-full text-left text-sm", className)}
				{...props}
			/>
		</div>
	);
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
	return (
		<thead
			data-slot="table-header"
			className={cn("text-muted-foreground", className)}
			{...props}
		/>
	);
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
	return (
		<tbody
			data-slot="table-body"
			className={cn(
				"[&_tr:nth-child(even):not(:hover)]:bg-surface-sunken [&_tr:hover]:bg-accent",
				className,
			)}
			{...props}
		/>
	);
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
	return <tr data-slot="table-row" className={cn(className)} {...props} />;
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
	return (
		<th
			data-slot="table-head"
			className={cn(
				"px-4 py-1.5 align-middle font-medium pointer-coarse:py-3",
				className,
			)}
			{...props}
		/>
	);
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
	return (
		<td
			data-slot="table-cell"
			className={cn(
				"px-4 py-1.5 align-middle pointer-coarse:py-3",
				className,
			)}
			{...props}
		/>
	);
}

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
