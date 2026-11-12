"use client";

import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/class-names";
import { useSidebar } from "../context";

/** The list of entries inside a group. */
export function SidebarMenu({
	className,
	...props
}: React.ComponentProps<"ul">) {
	return (
		<ul
			data-slot="sidebar-menu"
			className={cn("flex w-full min-w-0 flex-col gap-0.5", className)}
			{...props}
		/>
	);
}

/** One entry of a menu. */
export function SidebarMenuItem({
	className,
	...props
}: React.ComponentProps<"li">) {
	return (
		<li
			data-slot="sidebar-menu-item"
			className={cn("group/menu-item relative", className)}
			{...props}
		/>
	);
}

/**
 * The control of an entry: 32 px tall on a fine pointer (the sidebar item the
 * measured references use), 44 px on a coarse one. Collapsed to icons it is a
 * square with a tooltip carrying the label.
 */
export function SidebarMenuButton({
	asChild = false,
	isActive = false,
	tooltip,
	className,
	...props
}: React.ComponentProps<"button"> & {
	asChild?: boolean;
	isActive?: boolean;
	/** Label shown beside the icon while the sidebar is collapsed. */
	tooltip?: string;
}) {
	const Comp = asChild ? Slot : "button";
	const { isMobile, state } = useSidebar();

	const button = (
		<Comp
			data-slot="sidebar-menu-button"
			data-active={isActive}
			className={cn(
				"flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-md px-2 text-left text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring active:bg-sidebar-accent/70 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:bg-sidebar-accent pointer-coarse:min-h-11 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pointer-coarse:size-11 group-data-[collapsible=icon]:[&>span]:sr-only [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
				className,
			)}
			{...props}
		/>
	);

	// No tooltip in the mobile sheet: a Radix tooltip that is mounted, even
	// hidden, handles Escape itself and so stops the native dialog closing.
	if (!tooltip || isMobile) {
		return button;
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild>{button}</TooltipTrigger>
			<TooltipContent
				side="right"
				align="center"
				hidden={state !== "collapsed"}
			>
				{tooltip}
			</TooltipContent>
		</Tooltip>
	);
}
