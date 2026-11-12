"use client";

import * as React from "react";

import { cn } from "@/lib/class-names";
import { SidebarContext, type SidebarContextProps } from "../context";
import { useIsMobile } from "../use-is-mobile";

/** Name of the cookie that keeps the desktop sidebar open or collapsed. */
export const SIDEBAR_COOKIE = "sidebar_state";
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const SIDEBAR_KEYBOARD_SHORTCUT = "b";

/**
 * Holds the sidebar state and lays out the shell. The width variables are
 * Tailwind classes, not a `style` attribute: the panel serves
 * `style-src 'self'`, and a server-rendered `style` would be blocked and break
 * the layout. On a coarse pointer the collapsed rail grows to fit a 44 px target.
 */
export function SidebarProvider({
	defaultOpen = true,
	className,
	children,
	...props
}: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
	const isMobile = useIsMobile();
	const [openMobile, setOpenMobile] = React.useState(false);
	const [open, setOpenState] = React.useState(defaultOpen);

	const setOpen = React.useCallback((value: boolean) => {
		setOpenState(value);
		// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not Baseline widely available yet.
		document.cookie = `${SIDEBAR_COOKIE}=${value}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`;
	}, []);

	const toggleSidebar = React.useCallback(() => {
		if (isMobile) {
			setOpenMobile((current) => !current);
		} else {
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
	};

	return (
		<SidebarContext.Provider value={value}>
			<div
				data-slot="sidebar-wrapper"
				className={cn(
					"group/sidebar-wrapper flex min-h-svh w-full [--sidebar-width-icon:3rem] [--sidebar-width:14rem] pointer-coarse:[--sidebar-width-icon:4rem]",
					className,
				)}
				{...props}
			>
				{children}
			</div>
		</SidebarContext.Provider>
	);
}
