"use client";

import { ChevronDownIcon } from "lucide-react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useSidebar } from "@/components/ui/sidebar/context";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
} from "@/components/ui/sidebar/group";
import type { SidebarGroupId } from "@/components/ui/sidebar/groups-cookie";

/**
 * A group of the sidebar's navigation that opens and closes under its heading.
 * The heading is a button that says whether the group is open
 * (`aria-expanded`) and what it controls; Enter and Space work it. A group
 * starts open, and a closed one keeps its entries out of the page.
 *
 * Whether it is open is kept by the sidebar's provider under the group's
 * `id`, in a cookie the layout reads on the server: a group that was closed is
 * still closed after a reload and in the first paint, in both areas.
 *
 * A closed group does not hide where the person is: when the current page is
 * one of its entries the caller hands that entry over as `current`, and it is
 * the one thing a closed group still draws.
 *
 * While the rail is collapsed to icons there is no heading to press, so every
 * group shows its entries whatever was chosen before, and the choice comes
 * back when the rail expands.
 */
export function NavSection({
	id,
	label,
	current,
	children,
}: {
	/** Which group this is, of the ones the sidebar knows how to keep closed. */
	id: SidebarGroupId;
	/** The group's heading, already translated. */
	label: string;
	/** The entry of the current page, when it is in this group: drawn while the group is closed. */
	current?: React.ReactNode;
	children: React.ReactNode;
}) {
	const { state, isMobile, closedGroups, setGroupOpen } = useSidebar();
	const rail = state === "collapsed" && !isMobile;
	const open = rail || !closedGroups.includes(id);

	return (
		<Collapsible
			open={open}
			onOpenChange={(next) => setGroupOpen(id, next)}
			// The root is the sidebar's group, and is named as one: the
			// collapsible's own name would hide it from whoever looks for groups.
			data-slot="sidebar-group"
			asChild
		>
			<SidebarGroup>
				<SidebarGroupLabel asChild>
					<CollapsibleTrigger className="group/toggle w-full justify-between gap-2 text-left hover:cursor-pointer hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sidebar-ring active:bg-sidebar-accent/80 pointer-coarse:h-11">
						<span className="min-w-0 truncate">{label}</span>
						<ChevronDownIcon
							aria-hidden="true"
							className="size-4 shrink-0 group-data-[state=closed]/toggle:-rotate-90"
						/>
					</CollapsibleTrigger>
				</SidebarGroupLabel>
				<CollapsibleContent>
					<SidebarGroupContent>{children}</SidebarGroupContent>
				</CollapsibleContent>
				{open || current === undefined || current === null ? null : (
					<SidebarGroupContent data-slot="sidebar-group-current">
						{current}
					</SidebarGroupContent>
				)}
			</SidebarGroup>
		</Collapsible>
	);
}
