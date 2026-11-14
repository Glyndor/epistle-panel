import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { requireAdmin } from "@/lib/auth/require-session";

/** The trail of the domains page, in the header: the administration, then this page. */
export default async function Trail() {
	const { routes } = await requireAdmin();

	return <AdminBreadcrumbs routes={routes} page="domains" />;
}
