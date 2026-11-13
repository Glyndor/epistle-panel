import type * as React from "react";

import { cn } from "@/lib/class-names";

/**
 * The state of a list or a section with nothing in it: a title, a line that
 * says what to do next and, optionally, the action. Compact, so it fits inside
 * a table or a card; it draws no border.
 */
function Empty({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty"
			className={cn(
				"flex min-w-0 flex-col items-center justify-center gap-2 p-6 text-center text-balance",
				className,
			)}
			{...props}
		/>
	);
}

/** The text block of an {@link Empty}. */
function EmptyHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-header"
			className={cn(
				"flex max-w-sm flex-col items-center gap-1",
				className,
			)}
			{...props}
		/>
	);
}

/** The icon of an {@link Empty}, on a soft tonal tile. */
function EmptyIcon({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="empty-icon"
			className={cn(
				"flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground [&_svg:not([class*='size-'])]:size-5",
				className,
			)}
			{...props}
		/>
	);
}

/** The title of an {@link Empty}. */
function EmptyTitle({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="empty-title"
			className={cn("font-medium text-sm", className)}
			{...props}
		/>
	);
}

/** The explanation of an {@link Empty}. */
function EmptyDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			data-slot="empty-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

export { Empty, EmptyDescription, EmptyHeader, EmptyIcon, EmptyTitle };
