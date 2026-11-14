import { Slot } from "@radix-ui/react-slot";
import {
	ChevronLeftIcon,
	ChevronRightIcon,
	MoreHorizontalIcon,
} from "lucide-react";
import type * as React from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/class-names";

/** The page controls of a list, a navigation landmark. Name it with `aria-label`. */
function Pagination({
	className,
	"aria-label": label,
	...props
}: React.ComponentProps<"nav"> & { "aria-label": string }) {
	return (
		<nav
			aria-label={label}
			data-slot="pagination"
			className={cn("flex", className)}
			{...props}
		/>
	);
}

/** The list of the controls, in reading order. */
function PaginationContent({
	className,
	...props
}: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="pagination-content"
			className={cn(
				"flex flex-row flex-wrap items-center gap-1",
				className,
			)}
			{...props}
		/>
	);
}

/** One control of the list. */
function PaginationItem(props: React.ComponentProps<"li">) {
	return <li data-slot="pagination-item" {...props} />;
}

type PaginationLinkProps = Omit<React.ComponentProps<"button">, "disabled"> & {
	/** The page on screen: marked with `aria-current` and filled. */
	isActive?: boolean;
	/**
	 * Nowhere to go from here (the first or the last page). The control stays
	 * in the tab order and says it is unavailable, so the focus is not lost
	 * when the page under it becomes the last one.
	 */
	disabled?: boolean;
	/** Render the child (a link, for a list the server pages) instead of a button. */
	asChild?: boolean;
};

/**
 * A page control: a button, since the panel's tables change page in place. 32 px
 * on a fine pointer and at least 44 px on a coarse one, wider when the number
 * needs it. The current page is a filled button, the others are bare. A
 * control with nowhere to go dims what it holds, not itself: its focus ring
 * has to keep its contrast (dimmed with the button it measured 1.89:1 in the
 * light theme and 2.75:1 in the dark one, under the 3:1 a ring needs).
 */
function PaginationLink({
	className,
	isActive = false,
	disabled = false,
	asChild = false,
	onClick,
	...props
}: PaginationLinkProps) {
	const Comp = asChild ? Slot : "button";
	return (
		<Comp
			{...(asChild ? {} : { type: "button" as const })}
			aria-current={isActive ? "page" : undefined}
			aria-disabled={disabled ? true : undefined}
			data-slot="pagination-link"
			data-active={isActive}
			onClick={disabled ? undefined : onClick}
			className={cn(
				buttonVariants({
					variant: isActive ? "default" : "ghost",
					size: "default",
				}),
				"group/link px-2 tabular-nums aria-disabled:pointer-events-none pointer-coarse:px-2",
				className,
			)}
			{...props}
		/>
	);
}

/** What a previous or next control holds, dimmed while it has nowhere to go. */
const DIMMED_AT_AN_END = "group-aria-disabled/link:opacity-50";

/** The control that goes one page back. Its children are its visible name. */
function PaginationPrevious({ children, ...props }: PaginationLinkProps) {
	return (
		<PaginationLink data-slot="pagination-previous" {...props}>
			<ChevronLeftIcon aria-hidden="true" className={DIMMED_AT_AN_END} />
			<span className={DIMMED_AT_AN_END}>{children}</span>
		</PaginationLink>
	);
}

/** The control that goes one page on. Its children are its visible name. */
function PaginationNext({ children, ...props }: PaginationLinkProps) {
	return (
		<PaginationLink data-slot="pagination-next" {...props}>
			<span className={DIMMED_AT_AN_END}>{children}</span>
			<ChevronRightIcon aria-hidden="true" className={DIMMED_AT_AN_END} />
		</PaginationLink>
	);
}

/** The mark of the pages left out between two runs of numbers; it is decoration. */
function PaginationEllipsis({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			aria-hidden="true"
			data-slot="pagination-ellipsis"
			className={cn(
				"flex size-8 items-center justify-center text-muted-foreground pointer-coarse:size-11",
				className,
			)}
			{...props}
		>
			<MoreHorizontalIcon className="size-4" />
		</span>
	);
}

export {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
};
