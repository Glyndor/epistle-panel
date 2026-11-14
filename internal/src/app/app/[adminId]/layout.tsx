import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AdminRoutesProvider } from "@/components/layout/admin-routes";
import { AppShell } from "@/components/layout/app-shell";
import { NavMain } from "@/components/layout/nav-main";
import { QueryProvider } from "@/components/layout/query-provider";
import { closedSidebarGroups } from "@/components/ui/sidebar/closed-groups";
import {
	SIDEBAR_COOKIE,
	sidebarStartsOpen,
} from "@/components/ui/sidebar/cookie";
import { SIDEBAR_GROUPS_COOKIE } from "@/components/ui/sidebar/groups-cookie";
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
 *
 * Whether the sidebar starts collapsed, and which of its groups start closed,
 * are read here from their cookies, so the first paint is the one the person
 * left.
 *
 * The header's trail is the `trail` slot: a page of its own beside each page,
 * so the layout does not have to know which page it frames.
 */
export default async function AdminLayout({
	children,
	trail,
	params,
}: Readonly<{
	children: React.ReactNode;
	trail: React.ReactNode;
	params: Promise<{ adminId: string }>;
}>) {
	const { sub, id, routes } = await requireAdmin();
	if (!constantTimeEqual((await params).adminId, id)) {
		notFound();
	}
	const t = await getTranslations("nav");
	const jar = await cookies();
	const open = sidebarStartsOpen(jar.get(SIDEBAR_COOKIE)?.value);
	const closedGroups = closedSidebarGroups(
		jar.get(SIDEBAR_GROUPS_COOKIE)?.value,
	);

	return (
		<AdminRoutesProvider adminId={id}>
			<QueryProvider>
				<AppShell
					navigation={
						<NavMain
							groups={navForRole("admin", navItems(routes))}
						/>
					}
					homeHref={routes.home}
					subtitle={t("brandSubtitle")}
					sheet={{
						title: t("sheetTitle"),
						description: t("sheetDescription"),
					}}
					trail={trail}
					user={{ name: sub, role: "admin" }}
					adminHref={routes.home}
					defaultOpen={open}
					closedGroups={closedGroups}
				>
					{children}
				</AppShell>
			</QueryProvider>
		</AdminRoutesProvider>
	);
}
