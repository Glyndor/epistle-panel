"use client";

import { PanelLeftIcon } from "lucide-react";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/class-names";
import { useSidebar } from "../context";

/** Button that collapses or expands the sidebar, or opens the sheet on a small screen. */
export function SidebarTrigger({
	className,
	onClick,
	label,
	...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
	/** Accessible name, already translated by the caller. */
	label: string;
}) {
	const { toggleSidebar } = useSidebar();

	return (
		<Button
			data-sidebar="trigger"
			data-slot="sidebar-trigger"
			variant="ghost"
			size="icon"
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
	);
}
