import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/layout/query-provider";
import { closedSidebarGroups } from "@/components/ui/sidebar/closed-groups";
import {
	SIDEBAR_COOKIE,
	sidebarStartsOpen,
} from "@/components/ui/sidebar/cookie";
import { SIDEBAR_GROUPS_COOKIE } from "@/components/ui/sidebar/groups-cookie";
import { MailNav } from "@/features/mail/components/mail-nav";
import {
	QuotaMeter,
	QuotaPlaceholder,
} from "@/features/mail/components/quota-meter";
import { requestMailSession } from "@/features/mail/queries/request-mail";
import { RefreshProvider } from "@/features/refresh/components/refresh-provider";
import { readEffectiveRefreshPace } from "@/features/refresh/queries/refresh-pace";
import { TimeZoneProvider } from "@/features/time-zone/components/time-zone-provider";
import { readEffectiveTimeZone } from "@/features/time-zone/queries/time-zone";
import { requireSession } from "@/lib/auth/require-session";
import { readAdminId } from "@/lib/config/admin-id";
import { adminRoutes, PUBLIC_ROUTES } from "@/lib/routes";

/**
 * The frame of the webmail: the panel's shell with the mail area's own parts.
 * The sidebar holds the way into the composer and the account's folders, and
 * the account's storage at its foot; the header holds the trail of the page
 * (the `trail` slot, a page of its own beside each page) and the search of the
 * area (the `search` slot, beside it). The middle of the bar is kept for the
 * search, which is there on every page that has a folder to search in; the
 * composer has none, and the bar keeps no empty cell for it. Nothing of the
 * frame scrolls: each pane of a page does.
 *
 * Without a session it redirects to sign-in before anything renders. Whether
 * the sidebar starts collapsed, and whether its folders start closed, are read
 * here from their cookies, so the first paint is already the one the person
 * left: the placeholder of the folders is drawn closed too.
 *
 * The pace of the refreshes wraps the whole frame, not only the page: the
 * folders of the sidebar and the folder picker of the search poll too, and
 * they are drawn from slots the page's children do not contain.
 */
export default async function MailLayout({
	children,
	trail,
	search,
}: Readonly<{
	children: React.ReactNode;
	trail: React.ReactNode;
	search: React.ReactNode;
}>) {
	const session = await requireSession();
	// The way into the administration exists only for an admin session, in an
	// installation whose admin area is on; its address, id included, is built here.
	const adminId = session.role === "admin" ? await readAdminId() : undefined;
	const t = await getTranslations("mail");
	const hasMail = (await requestMailSession()) !== null;
	const timeZone = await readEffectiveTimeZone();
	const refreshPace = await readEffectiveRefreshPace();
	const jar = await cookies();
	const open = sidebarStartsOpen(jar.get(SIDEBAR_COOKIE)?.value);
	const closedGroups = closedSidebarGroups(
		jar.get(SIDEBAR_GROUPS_COOKIE)?.value,
	);

	return (
		<QueryProvider>
			<RefreshProvider pace={refreshPace}>
				<AppShell
					navigation={
						<MailNav
							foldersOpen={!closedGroups.includes("folders")}
							timeZone={timeZone}
						/>
					}
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
					search={search}
					reserveSearch={search !== null && search !== undefined}
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
					closedGroups={closedGroups}
					content="panes"
				>
					<TimeZoneProvider timeZone={timeZone}>
						{children}
					</TimeZoneProvider>
				</AppShell>
			</RefreshProvider>
		</QueryProvider>
	);
}
