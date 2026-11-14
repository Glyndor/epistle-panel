"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

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

/**
 * A group of the sidebar's navigation that opens and closes under its heading.
 * The heading is a button that says whether the group is open
 * (`aria-expanded`) and what it controls; Enter and Space work it. A group
 * starts open, and a closed one keeps its entries out of the page.
 *
 * While the rail is collapsed to icons there is no heading to press, so every
 * group shows its entries whatever was chosen before, and the choice comes
 * back when the rail expands.
 */
export function NavSection({
	label,
	defaultOpen = true,
	children,
}: {
	/** The group's heading, already translated. */
	label: string;
	defaultOpen?: boolean;
	children: React.ReactNode;
}) {
	const { state, isMobile } = useSidebar();
	const [open, setOpen] = useState(defaultOpen);
	const rail = state === "collapsed" && !isMobile;

	return (
		<Collapsible
			open={open || rail}
			onOpenChange={setOpen}
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
			</SidebarGroup>
		</Collapsible>
	);
}
