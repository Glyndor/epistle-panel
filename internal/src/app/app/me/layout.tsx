import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/layout/query-provider";
import {
	SIDEBAR_COOKIE,
	sidebarStartsOpen,
} from "@/components/ui/sidebar/cookie";
import { MeNav } from "@/features/preferences/components/me-nav";
import { MeTrail } from "@/features/preferences/components/me-trail";
import { requireSession } from "@/lib/auth/require-session";
import { readAdminId } from "@/lib/config/admin-id";
import { adminRoutes, PUBLIC_ROUTES } from "@/lib/routes";

/**
 * The frame of the person's own page: the panel's shell with a navigation of
 * its own, since the page belongs to neither area. It is the same for every
 * role, because what a person chooses here is theirs whatever they administer.
 * The way into the administration appears only for an admin session in an
 * installation whose admin area is on, and its address, id included, is built
 * here.
 *
 * Without a session it redirects to sign-in before anything renders (the proxy
 * has already done so; this is the second check). Whether the sidebar starts
 * collapsed is read here from its cookie, so the first paint is the one the
 * person left.
 */
export default async function MeLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await requireSession();
	const adminId = session.role === "admin" ? await readAdminId() : undefined;
	const adminHref =
		adminId === undefined ? undefined : adminRoutes(adminId).home;
	const t = await getTranslations("nav");
	const open = sidebarStartsOpen(
		(await cookies()).get(SIDEBAR_COOKIE)?.value,
	);

	return (
		<QueryProvider>
			<AppShell
				navigation={<MeNav adminHref={adminHref} />}
				homeHref={PUBLIC_ROUTES.mail}
				subtitle={t("preferences")}
				sheet={{
					title: t("sheetTitle"),
					description: t("meSheetDescription"),
				}}
				trail={<MeTrail />}
				user={{ name: session.sub, role: session.role }}
				adminHref={adminHref}
				defaultOpen={open}
			>
				{children}
			</AppShell>
		</QueryProvider>
	);
}
