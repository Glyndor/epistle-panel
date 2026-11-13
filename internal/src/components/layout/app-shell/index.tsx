import type { Route } from "next";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppToaster } from "@/components/layout/app-toaster";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { StyleNonce } from "@/components/layout/style-nonce";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { SidebarInset } from "@/components/ui/sidebar/regions";
import type { NavGroup } from "@/features/navigation/schemas/nav-item";
import type { SessionRole } from "@/lib/auth/session";

/**
 * The shell of a surface that has a sidebar: skip link, sidebar, header and the
 * single `main` landmark the skip link targets. Its navigation is data, so the
 * admin pages and the future webmail's folders-and-settings area share it and
 * differ only in the groups they pass.
 *
 * Layout contract: a surface that needs another frame (the webmail's three-pane
 * reader) does not extend this component. It renders its own layout from the
 * parts in `components/ui/sidebar` and keeps the same rules: one `main`, a skip
 * link first, a named landmark per region, no inline style.
 */
export function AppShell({
	groups,
	homeHref,
	user,
	adminHref,
	defaultOpen,
	children,
}: {
	groups: readonly NavGroup[];
	homeHref: Route;
	/** The account of the session, shown in the profile menu of the header. */
	user: { name: string; role: SessionRole };
	/** The address of the administration, for an admin session only. */
	adminHref?: string | undefined;
	defaultOpen: boolean;
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<StyleNonce />
			<SkipLink />
			<AppSidebar groups={groups} homeHref={homeHref} />
			<SidebarInset>
				<SiteHeader user={user} adminHref={adminHref} />
				<main
					id="main-content"
					className="flex min-w-0 flex-1 flex-col gap-3 p-4 md:px-6"
				>
					{children}
				</main>
			</SidebarInset>
			<AppToaster />
		</SidebarProvider>
	);
}
