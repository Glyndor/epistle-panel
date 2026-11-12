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

/** Heading of a group; it fades out when the sidebar collapses to icons. */
export function SidebarGroupLabel({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-group-label"
			className={cn(
				"flex h-8 shrink-0 items-center rounded-md px-2 font-medium text-sidebar-foreground/80 text-xs group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0",
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
