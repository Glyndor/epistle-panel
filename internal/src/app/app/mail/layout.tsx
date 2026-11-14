import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/layout/query-provider";
import {
	SIDEBAR_COOKIE,
	sidebarStartsOpen,
} from "@/components/ui/sidebar/cookie";
import { MailNav } from "@/features/mail/components/mail-nav";
import {
	QuotaMeter,
	QuotaPlaceholder,
} from "@/features/mail/components/quota-meter";
import { requestMailSession } from "@/features/mail/queries/request-mail";
import { requireSession } from "@/lib/auth/require-session";
import { readAdminId } from "@/lib/config/admin-id";
import { adminRoutes, PUBLIC_ROUTES } from "@/lib/routes";

/**
 * The frame of the webmail: the panel's shell with the mail area's own parts.
 * The sidebar holds the way into the composer and the account's folders, and
 * the account's storage at its foot; the header holds the trail of the page
 * (the `trail` slot, a page of its own beside each page). Its middle is not
 * kept for the search until there is one: the shell's `reserveSearch` is the
 * switch. Nothing of the frame scrolls: each pane of a page does.
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
	const hasMail = (await requestMailSession()) !== null;
	const open = sidebarStartsOpen(
		(await cookies()).get(SIDEBAR_COOKIE)?.value,
	);

	return (
		<QueryProvider>
			<AppShell
				navigation={<MailNav />}
				sidebarFooter={
					// A session with no mail of its own has no storage to ask
					// for: nothing is drawn, and nothing holds its place.
					hasMail ? (
						<Suspense fallback={<QuotaPlaceholder />}>
							<QuotaMeter />
						</Suspense>
					) : null
				}
				homeHref={PUBLIC_ROUTES.mail}
				subtitle={t("heading")}
				sheet={{
					title: t("navTitle"),
					description: t("foldersDescription"),
				}}
				trail={trail}
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
