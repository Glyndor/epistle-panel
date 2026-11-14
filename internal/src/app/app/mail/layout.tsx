import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/layout/query-provider";
import { SIDEBAR_COOKIE } from "@/components/ui/sidebar/provider";
import { MailNav } from "@/features/mail/components/mail-nav";
import { QuotaMeter } from "@/features/mail/components/quota-meter";
import { requireSession } from "@/lib/auth/require-session";
import { readAdminId } from "@/lib/config/admin-id";
import { adminRoutes, PUBLIC_ROUTES } from "@/lib/routes";

/**
 * The frame of the webmail: the panel's shell with the mail area's own parts.
 * The sidebar holds the way into the composer and the account's folders, and
 * the account's storage at its foot; the header holds the trail of the page
 * (the `trail` slot, a page of its own beside each page) and keeps its middle
 * for the search. Nothing of the frame scrolls: each pane of a page does.
 *
 * Without a session it redirects to sign-in before anything renders. Whether
 * the sidebar starts collapsed is read here, from its cookie, so the first
 * paint is already the one the person left.
 */
export default async function MailLayout({
	children,
	trail,
}: Readonly<{ children: React.ReactNode; trail: React.ReactNode }>) {
	const session = await requireSession();
	// The way into the administration exists only for an admin session, in an
	// installation whose admin area is on; its address, id included, is built here.
	const adminId = session.role === "admin" ? await readAdminId() : undefined;
	const t = await getTranslations("mail");
	const open = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "false";

	return (
		<QueryProvider>
			<AppShell
				navigation={<MailNav />}
				sidebarFooter={
					// Nothing holds its place: an account with no quota has no meter.
					<Suspense fallback={null}>
						<QuotaMeter />
					</Suspense>
				}
				homeHref={PUBLIC_ROUTES.mail}
				subtitle={t("heading")}
				sheet={{
					title: t("foldersTitle"),
					description: t("foldersDescription"),
				}}
				trail={trail}
				reserveSearch
				user={{ name: session.sub, role: session.role }}
				adminHref={
					adminId === undefined
						? undefined
						: adminRoutes(adminId).home
				}
				defaultOpen={open}
				content="panes"
			>
				{children}
			</AppShell>
		</QueryProvider>
	);
}
