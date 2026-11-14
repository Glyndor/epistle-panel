"use client";

import * as React from "react";

import { cn } from "@/lib/class-names";
import { SidebarContext, type SidebarContextProps } from "../context";
import { sidebarCookie } from "../cookie";
import { type SidebarGroupId, sidebarGroupsCookie } from "../groups-cookie";
import { useIsMobile } from "../use-is-mobile";

const SIDEBAR_KEYBOARD_SHORTCUT = "b";

/**
 * Collapsed to icons, the heading of a group is not drawn. A heading that has
 * the focus when the rail collapses would drop it on the page; it is handed to
 * the sidebar's toggle instead, which is where the person can undo it.
 */
function handFocusToToggle(): void {
	const focused = document.activeElement;
	if (
		focused instanceof HTMLElement &&
		focused.matches("[data-slot='sidebar-group-label']")
	) {
		document
			.querySelector<HTMLElement>("[data-slot='sidebar-trigger']")
			?.focus();
	}
}

/**
 * Holds the sidebar state and lays out the shell, which is exactly as tall as
 * the window: the sidebar and the header stay in place and what scrolls is
 * inside the inset. The width variables are Tailwind classes, not a `style`
 * attribute: the panel serves `style-src 'self'`, and a server-rendered
 * `style` would be blocked and break the layout. On a coarse pointer the
 * collapsed rail grows to fit a 44 px target.
 *
 * It also holds which groups of the navigation are closed. That is kept here
 * and not by each group: the folders of the mail area come in a streamed part
 * that replaces its placeholder, and a note kept by the group would be made
 * anew with it. Both states start from what the layout read from their
 * cookies, so the page the server sends is already the one the person left.
 */
export function SidebarProvider({
	defaultOpen = true,
	defaultClosedGroups,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & {
	defaultOpen?: boolean;
	/** The groups of the navigation that start closed, as the layout read them. */
	defaultClosedGroups?: readonly SidebarGroupId[];
}) {
	const isMobile = useIsMobile();
	const [openMobile, setOpenMobile] = React.useState(false);
	const [open, setOpenState] = React.useState(defaultOpen);
	const [closedGroups, setClosedGroups] = React.useState<
		readonly SidebarGroupId[]
	>(defaultClosedGroups ?? []);

	const setGroupOpen = (id: SidebarGroupId, groupOpen: boolean) => {
		const next = groupOpen
			? closedGroups.filter((closed) => closed !== id)
			: closedGroups.includes(id)
				? closedGroups
				: [...closedGroups, id];
		setClosedGroups(next);
		// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not Baseline widely available yet.
		document.cookie = sidebarGroupsCookie(next);
	};

	const setOpen = React.useCallback((value: boolean) => {
		setOpenState(value);
		// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not Baseline widely available yet.
		document.cookie = sidebarCookie(value);
	}, []);

	const toggleSidebar = React.useCallback(() => {
		if (isMobile) {
			setOpenMobile((current) => !current);
		} else {
			if (open) {
				handFocusToToggle();
			}
			setOpen(!open);
		}
	}, [isMobile, open, setOpen]);

	React.useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (
				event.key === SIDEBAR_KEYBOARD_SHORTCUT &&
				(event.metaKey || event.ctrlKey)
			) {
				event.preventDefault();
				toggleSidebar();
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [toggleSidebar]);

	// No `useMemo`: React Compiler (`reactCompiler` in next.config.ts) memoizes
	// the context value. The two callbacks stay because the effect above lists
	// one as a dependency, which Biome checks without the compiler.
	const value: SidebarContextProps = {
		state: open ? "expanded" : "collapsed",
		open,
		setOpen,
		isMobile,
		openMobile,
		setOpenMobile,
		toggleSidebar,
		closedGroups,
		setGroupOpen,
	};

	return (
		<SidebarContext.Provider value={value}>
			<div
				data-slot="sidebar-wrapper"
				className={cn(
					"group/sidebar-wrapper flex h-dvh w-full [--sidebar-width-icon:3rem] [--sidebar-width:14rem] pointer-coarse:[--sidebar-width-icon:4rem]",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}
