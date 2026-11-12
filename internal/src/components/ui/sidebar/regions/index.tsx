import type * as React from "react";

import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/class-names";

/** Top region of the sidebar. */
export function SidebarHeader({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-header"
			className={cn("flex flex-col gap-1 p-2", className)}
			{...props}
		/>
	);
}

/** Bottom region of the sidebar. */
export function SidebarFooter({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-footer"
			className={cn("flex flex-col gap-1 p-2", className)}
			{...props}
		/>
	);
}

/** Scrollable middle region of the sidebar. */
export function SidebarContent({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-content"
			className={cn(
				"flex min-h-0 flex-1 flex-col gap-1 overflow-auto group-data-[collapsible=icon]:overflow-hidden",
				className,
			)}
			{...props}
		/>
	);
}

/** A rule between sidebar groups. */
export function SidebarSeparator({
	className,
	...props
}: React.ComponentProps<typeof Separator>) {
	return (
		<Separator
			data-slot="sidebar-separator"
			className={cn("mx-2 w-auto bg-sidebar-border", className)}
			{...props}
		/>
	);
}

/**
 * The area that sits beside the sidebar. It is a plain `div`: the page's single
 * `main` landmark is rendered by the app layout, so there are never two.
 */
export function SidebarInset({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="sidebar-inset"
			className={cn(
				"relative flex min-w-0 flex-1 flex-col bg-background",
				className,
			)}
			{...props}
		/>
	);
}
