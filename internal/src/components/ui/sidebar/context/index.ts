"use client";

import * as React from "react";

/** What every sidebar part reads from its provider. */
export interface SidebarContextProps {
	state: "expanded" | "collapsed";
	open: boolean;
	setOpen: (open: boolean) => void;
	openMobile: boolean;
	setOpenMobile: (open: boolean) => void;
	isMobile: boolean;
	toggleSidebar: () => void;
}

/** Context carrying the sidebar state; created empty so a missing provider is caught. */
export const SidebarContext = React.createContext<SidebarContextProps | null>(
	null,
);

/** Read the sidebar state. Throws outside a `SidebarProvider`. */
export function useSidebar(): SidebarContextProps {
	const context = React.useContext(SidebarContext);
	if (!context) {
		throw new Error("useSidebar must be used within a SidebarProvider.");
	}
	return context;
}
