import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { cn } from "@/lib/class-names";

/** One labelled run of menu entries. */
export function SidebarGroup({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group"
			className={cn(
				"relative flex w-full min-w-0 flex-col p-2",
				className,
			)}
			{...props}
		/>
	);
}

/**
 * Heading of a group; it is not drawn while the sidebar is collapsed to icons.
 * With `asChild` it is the element passed as its child: the button that opens
 * and closes the group.
 */
export function SidebarGroupLabel({
	asChild = false,
	className,
	...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : "div";
	return (
		<Comp
			data-slot="sidebar-group-label"
			className={cn(
				"flex h-8 shrink-0 items-center rounded-md px-2 font-medium text-sidebar-foreground/80 text-xs group-data-[collapsible=icon]:hidden",
				className,
			)}
			{...props}
		/>
	);
}

/** The entries of a group. */
export function SidebarGroupContent({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-content"
			className={cn("w-full text-sm", className)}
			{...props}
		/>
	);
}
