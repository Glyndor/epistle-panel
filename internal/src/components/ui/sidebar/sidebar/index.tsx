"use client";

import type * as React from "react";

import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/class-names";
import { useSidebar } from "../context";

/**
 * The sidebar: a fixed rail that collapses to icons on desktop and a sheet on
 * a narrow viewport. The sheet needs a name, so the caller passes the already
 * translated `title`, `description` and `closeLabel`.
 */
export function Sidebar({
	className,
	children,
	title,
	description,
	closeLabel,
	...props
}: React.ComponentProps<"div"> & {
	title: string;
	description: string;
	closeLabel: string;
}) {
	const { isMobile, state, openMobile, setOpenMobile } = useSidebar();

	if (isMobile) {
		return (
			<Sheet
				open={openMobile}
				onOpenChange={setOpenMobile}
				side="left"
				title={title}
				description={description}
				closeLabel={closeLabel}
				data-sidebar="sidebar"
				data-slot="sidebar"
				data-mobile="true"
				className="w-(--sidebar-width) bg-sidebar text-sidebar-foreground [--sidebar-width:18rem]"
			>
				<div className="flex h-full w-full flex-col">{children}</div>
			</Sheet>
		);
	}

	return (
		<div
			className="group peer hidden text-sidebar-foreground md:block"
			data-state={state}
			data-collapsible={state === "collapsed" ? "icon" : ""}
			data-slot="sidebar"
		>
			<div
				data-slot="sidebar-gap"
				className="relative w-(--sidebar-width) bg-transparent transition-[width] duration-150 ease-linear group-data-[collapsible=icon]:w-(--sidebar-width-icon)"
			/>
			<div
				data-slot="sidebar-container"
				className={cn(
					"fixed inset-y-0 left-0 z-10 hidden h-svh w-(--sidebar-width) border-r transition-[width] duration-150 ease-linear group-data-[collapsible=icon]:w-(--sidebar-width-icon) md:flex",
					className,
				)}
				{...props}
			>
				<aside
					aria-label={title}
					data-sidebar="sidebar"
					data-slot="sidebar-inner"
					className="flex h-full w-full flex-col bg-sidebar"
				>
					{children}
				</aside>
			</div>
		</div>
	);
}
