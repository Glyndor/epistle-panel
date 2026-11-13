"use client";

import { createContext, useContext, useMemo } from "react";

import { type AdminRoutes, adminRoutes } from "@/lib/routes";

const AdminRoutesContext = createContext<AdminRoutes | null>(null);

/**
 * Hands the admin area's client components the paths they link to. The server
 * layout of the area passes the id it already checked, so the id reaches the
 * browser only inside pages that were served to a session with the admin role,
 * and only as the URLs those pages already carry.
 */
export function AdminRoutesProvider({
	adminId,
	children,
}: {
	adminId: string;
	children: React.ReactNode;
}) {
	const routes = useMemo(() => adminRoutes(adminId), [adminId]);
	return (
		<AdminRoutesContext.Provider value={routes}>
			{children}
		</AdminRoutesContext.Provider>
	);
}

/** The admin paths; it throws outside {@link AdminRoutesProvider}, which is a bug, not a state. */
export function useAdminRoutes(): AdminRoutes {
	const routes = useContext(AdminRoutesContext);
	if (routes === null) {
		throw new Error("useAdminRoutes needs an AdminRoutesProvider above it");
	}
	return routes;
}
