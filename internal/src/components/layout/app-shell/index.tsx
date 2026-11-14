import type { Route } from "next";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppToaster } from "@/components/layout/app-toaster";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { StyleNonce } from "@/components/layout/style-nonce";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { SidebarInset } from "@/components/ui/sidebar/regions";
import type { SessionRole } from "@/lib/auth/session";
import { cn } from "@/lib/class-names";

/**
 * The shell of both areas of the panel, the administration and the mail:
 * skip link, sidebar, header and the single `main` landmark the skip link
 * targets. It is as tall as the window and never scrolls itself: the sidebar,
 * its foot and the header stay where they are, and only the content moves.
 *
 * The three zones are told apart by tone, with no line between them: the rail
 * (`bg-sidebar`), the bar (`bg-header`) and the canvas (`bg-background`), on
 * which a work panel is a raised, rounded surface (`bg-surface`).
 *
 * What differs between the areas comes in as parts: the navigation, what the
 * sidebar's foot adds, the trail of the bar and the search in its middle. `content` says who scrolls: `page` for a page that scrolls as a
 * whole (the administration), `panes` for a page whose panes each scroll on
 * their own and fill the room themselves (the mail).
 *
 * Layout contract: one `main`, a skip link first, a named landmark per region,
 * no inline style.
 */
export function AppShell({
	navigation,
	sidebarFooter,
	homeHref,
	subtitle,
	sheet,
	trail,
	search,
	reserveSearch = false,
	user,
	adminHref,
	defaultOpen,
	content = "page",
	children,
}: {
	/** The area's navigation, drawn in the sidebar. */
	navigation: React.ReactNode;
	/** What the area adds to the sidebar's foot, above the version. */
	sidebarFooter?: React.ReactNode;
	homeHref: Route;
	/** What the area is, under the brand's name, already translated. */
	subtitle: string;
	/** How the sidebar is named when it is a sheet, already translated. */
	sheet: { title: string; description: string };
	/** The trail to the current page, drawn in the header. */
	trail?: React.ReactNode;
	/** The search of the area, in the middle of the header. */
	search?: React.ReactNode;
	/** Keep the middle of the header for the search, even before there is one. */
	reserveSearch?: boolean;
	/** The account of the session, shown in the profile menu of the header. */
	user: { name: string; role: SessionRole };
	/** The address of the administration, for an admin session only. */
	adminHref?: string | undefined;
	defaultOpen: boolean;
	content?: "page" | "panes";
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<StyleNonce />
			<SkipLink />
			<AppSidebar
				homeHref={homeHref}
				subtitle={subtitle}
				sheet={sheet}
				footer={sidebarFooter}
			>
				{navigation}
			</AppSidebar>
			<SidebarInset>
				<SiteHeader
					trail={trail}
					search={search}
					reserveSearch={reserveSearch}
					user={user}
					adminHref={adminHref}
				/>
				<main
					id="main-content"
					data-content={content}
					className={cn(
						"min-h-0 min-w-0 flex-1",
						content === "page"
							? "overflow-y-auto"
							: "overflow-hidden",
					)}
				>
					{content === "page" ? (
						// The padded column is a child of the scrolling box, not the
						// box itself: a flex column of a fixed height would squeeze
						// a table that scrolls sideways instead of letting the page
						// scroll.
						<div className="flex min-w-0 flex-col gap-3 p-4 md:px-6">
							{children}
						</div>
					) : (
						children
					)}
				</main>
			</SidebarInset>
			<AppToaster />
		</SidebarProvider>
	);
}
