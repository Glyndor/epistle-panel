import { Slot } from "@radix-ui/react-slot";
import { ChevronRightIcon } from "lucide-react";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/** The trail to the current page, a named navigation landmark. */
function Breadcrumb({
	"aria-label": label,
	...props
}: React.ComponentProps<"nav"> & { "aria-label": string }) {
	return <nav aria-label={label} data-slot="breadcrumb" {...props} />;
}

/** The ordered list of the trail. */
function BreadcrumbList({ className, ...props }: React.ComponentProps<"ol">) {
	return (
		<ol
			data-slot="breadcrumb-list"
			className={cn(
				"flex flex-wrap items-center gap-1.5 break-words text-muted-foreground text-sm",
				className,
			)}
			{...props}
		/>
	);
}

/** One step of the trail. */
function BreadcrumbItem({ className, ...props }: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-item"
			className={cn("inline-flex items-center gap-1.5", className)}
			{...props}
		/>
	);
}

/** A step that links to an earlier page, or the element passed as its child. */
function BreadcrumbLink({
	asChild,
	className,
	...props
}: React.ComponentProps<"a"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "a";
	return (
		<Comp
			data-slot="breadcrumb-link"
			className={cn(
				"inline-flex min-h-6 items-center rounded-md px-1 hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-ring active:bg-accent/70 pointer-coarse:min-h-11",
				className,
			)}
			{...props}
		/>
	);
}

/** The current page, marked with `aria-current` and bold so colour is not the only cue. */
function BreadcrumbPage({ className, ...props }: React.ComponentProps<"span">) {
	return (
		<span
			data-slot="breadcrumb-page"
			aria-current="page"
			className={cn("px-1 font-semibold text-foreground", className)}
			{...props}
		/>
	);
}

/** The mark between two steps; decorative. */
function BreadcrumbSeparator({
	className,
	...props
}: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="breadcrumb-separator"
			role="presentation"
			aria-hidden="true"
			className={cn("[&>svg]:size-3.5 rtl:[&>svg]:rotate-180", className)}
			{...props}
		>
			<ChevronRightIcon />
		</li>
	);
}

export {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
};
