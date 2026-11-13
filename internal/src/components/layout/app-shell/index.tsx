import type { Route } from "next";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppToaster } from "@/components/layout/app-toaster";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { SidebarInset } from "@/components/ui/sidebar/regions";
import type { NavGroup } from "@/features/navigation/schemas/nav-item";

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
	userName,
	defaultOpen,
	children,
}: {
	groups: readonly NavGroup[];
	homeHref: Route;
	userName: string;
	defaultOpen: boolean;
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<SkipLink />
			<AppSidebar name={userName} groups={groups} homeHref={homeHref} />
			<SidebarInset>
				<SiteHeader />
				<main
					id="main-content"
					className="flex min-w-0 flex-1 flex-col gap-3 p-4"
				>
					{children}
				</main>
			</SidebarInset>
			<AppToaster />
		</SidebarProvider>
	);
}
