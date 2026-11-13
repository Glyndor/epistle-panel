import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { AdminRoutesProvider } from "@/components/layout/admin-routes";
import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/layout/query-provider";
import { SIDEBAR_COOKIE } from "@/components/ui/sidebar/provider";
import { navItems } from "@/features/navigation/config/items";
import { navForRole } from "@/features/navigation/queries/nav-for-role";
import { requireAdmin } from "@/lib/auth/require-session";
import { constantTimeEqual } from "@/lib/routes";

/**
 * Layout of every admin page. The proxy already hides the area from anyone who
 * is not an admin with the right id; this is the second gate, for a request the
 * proxy did not see as it would: the account must hold the admin role, and the
 * `adminId` segment must be the configured id, compared without stopping at the
 * first difference. Either failing is the 404 of a path that does not exist. The
 * shell and the paths the client components link to are built from the id.
 */
export default async function AdminLayout({
	children,
	params,
}: Readonly<{
	children: React.ReactNode;
	params: Promise<{ adminId: string }>;
}>) {
	const { sub, id, routes } = await requireAdmin();
	if (!constantTimeEqual((await params).adminId, id)) {
		notFound();
	}
	const open = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "false";

	return (
		<AdminRoutesProvider adminId={id}>
			<QueryProvider>
				<AppShell
					groups={navForRole("admin", navItems(routes))}
					homeHref={routes.home}
					userName={sub}
					defaultOpen={open}
				>
					{children}
				</AppShell>
			</QueryProvider>
		</AdminRoutesProvider>
	);
}
