import "server-only";

import { readAdminId } from "@/lib/config/admin-id";
import { type AdminRoutes, adminRoutes } from "@/lib/routes";

/**
 * The admin routes for a `loading.tsx`, which is given no parameters and
 * cannot call `requireAdmin` (it must not end in a 404 of its own). The layout
 * above it has already settled who may be here, so the configured id is the
 * one in the address. With the admin area off there are no routes, and the
 * caller draws nothing that needs them.
 */
export async function loadingRoutes(): Promise<AdminRoutes | undefined> {
	const id = await readAdminId();
	return id === undefined ? undefined : adminRoutes(id);
}
