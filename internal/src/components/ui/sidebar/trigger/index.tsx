"use client";

import { PanelLeftIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/class-names";
import { useSidebar } from "../context";

/** What `aria-keyshortcuts` says for the key that works the sidebar: Ctrl+B, or Cmd+B. */
const TOGGLE_KEYS = "Control+B Meta+B";

/**
 * Button that collapses or expands the sidebar, or opens the sheet on a small
 * screen. It is an icon alone, so a tooltip names it and shows its key.
 */
export function SidebarTrigger({
	className,
	onClick,
	label,
	shortcut,
	...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
	/** Accessible name, already translated by the caller. */
	label: string;
	/** The key that does the same, as the tooltip writes it ("Ctrl+B"). */
	shortcut?: string | undefined;
}) {
	const { toggleSidebar, isMobile, open, openMobile } = useSidebar();

	return (
		<Tooltip label={label} shortcut={shortcut} align="start">
			<Button
				data-sidebar="trigger"
				data-slot="sidebar-trigger"
				variant="ghost"
				size="icon"
				aria-expanded={isMobile ? openMobile : open}
				aria-keyshortcuts={TOGGLE_KEYS}
				className={cn(className)}
				onClick={(event) => {
					onClick?.(event);
					toggleSidebar();
				}}
				{...props}
			>
				<PanelLeftIcon aria-hidden="true" />
				<span className="sr-only">{label}</span>
			</Button>
		</Tooltip>
	);
}
