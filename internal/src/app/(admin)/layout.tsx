import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { QueryProvider } from "@/components/layout/query-provider";
import { SIDEBAR_COOKIE } from "@/components/ui/sidebar/provider";
import { navForRole } from "@/features/navigation/queries/nav-for-role";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Layout of every admin page. Without a session it redirects to the login page
 * before anything renders; with one it draws the shell with the admin
 * navigation.
 */
export default async function AdminLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await requireSession();
	const open = (await cookies()).get(SIDEBAR_COOKIE)?.value !== "false";

	return (
		<QueryProvider>
			<AppShell
				groups={navForRole("admin")}
				userName={session.sub}
				defaultOpen={open}
			>
				{children}
			</AppShell>
		</QueryProvider>
	);
}
