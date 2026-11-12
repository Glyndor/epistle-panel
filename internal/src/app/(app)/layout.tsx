import { cookies } from "next/headers";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import {
	SIDEBAR_COOKIE,
	SidebarProvider,
} from "@/components/ui/sidebar/provider";
import { SidebarInset } from "@/components/ui/sidebar/regions";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Shell of every signed-in page: the sidebar, the header and the single `main`
 * landmark that the skip link targets. Without a session it redirects to the
 * login page before anything renders.
 */
export default async function AppLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await requireSession();
	const open = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "false";

	return (
		<SidebarProvider defaultOpen={open}>
			<SkipLink />
			<AppSidebar name={session.sub} />
			<SidebarInset>
				<SiteHeader />
				<main
					id="main-content"
					className="flex min-w-0 flex-1 flex-col gap-3 p-4"
				>
					{children}
				</main>
			</SidebarInset>
		</SidebarProvider>
	);
}
