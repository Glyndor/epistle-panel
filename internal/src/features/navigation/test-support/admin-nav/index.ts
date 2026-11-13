import { navItems } from "@/features/navigation/config/items";
import { navForRole } from "@/features/navigation/queries/nav-for-role";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { adminRoutes } from "@/lib/routes";

/** The admin paths of the test installation. */
export const TEST_ROUTES = adminRoutes(TEST_ADMIN_ID);

/** The navigation the admin sees in the test installation. */
export function adminNav() {
	return navForRole("admin", navItems(TEST_ROUTES));
}
