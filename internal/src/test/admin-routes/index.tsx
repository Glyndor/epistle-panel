import { AdminRoutesProvider } from "@/components/layout/admin-routes";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
import { withQuery } from "@/test/query-wrapper";

/** Wrap `ui` in the admin routes provider, as the admin layout does for the area. */
export function withAdminRoutes(ui: React.ReactNode): React.ReactElement {
	return (
		<AdminRoutesProvider adminId={TEST_ADMIN_ID}>{ui}</AdminRoutesProvider>
	);
}

/** The query client and the admin routes together, the context every admin page renders in. */
export function withAdminArea(ui: React.ReactNode): React.ReactElement {
	return withAdminRoutes(withQuery(ui));
}
