"use client";

import { Slot } from "@radix-ui/react-slot";
import type * as React from "react";

import { Tooltip } from "@/components/ui/tooltip";
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
 * square, and a tooltip beside it carries the label: the panel's own
 * `Tooltip`, shown only while the rail is collapsed, since an expanded entry
 * has its name written out.
 *
 * The current entry (`isActive`) is filled and bold. On the rail its name and
 * its weight are not drawn, and a fill alone is a colour: there it also gets a
 * mark on its starting edge, and the caller says so in the tooltip. Under the
 * pointer the current entry is still a link (the way back to the list from an
 * open message), so it answers too: its fill deepens and its name is
 * underlined, and a press deepens it further.
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
				"relative flex min-h-8 w-full items-center gap-2 overflow-hidden rounded-lg px-2 text-left text-sm before:pointer-events-none before:absolute before:inset-y-2 before:start-0 before:hidden before:w-1 before:rounded-e-full before:bg-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:outline-sidebar-ring active:bg-sidebar-accent/80 disabled:pointer-events-none disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground data-[active=true]:hover:bg-sidebar-foreground/10 data-[active=true]:hover:[&>span:first-of-type]:underline data-[active=true]:active:bg-sidebar-foreground/12 data-[state=open]:bg-sidebar-accent pointer-coarse:min-h-11 group-data-[collapsible=icon]:data-[active=true]:before:block group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 group-data-[collapsible=icon]:pointer-coarse:size-11 group-data-[collapsible=icon]:[&>span]:sr-only [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0",
				className,
			)}
			{...props}
		/>
	);

	if (!tooltip) {
		return button;
	}
	return (
		<Tooltip
			label={tooltip}
			side="right"
			slot="sidebar-tooltip"
			disabled={state !== "collapsed" || isMobile}
		>
			{button}
		</Tooltip>
	);
}
