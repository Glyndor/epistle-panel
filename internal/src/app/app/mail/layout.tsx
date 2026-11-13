import { AppToaster } from "@/components/layout/app-toaster";
import { QueryProvider } from "@/components/layout/query-provider";
import { SkipLink } from "@/components/layout/skip-link";
import { MailHeader } from "@/features/mail/components/mail-header";
import { requireSession } from "@/lib/auth/require-session";
import { readAdminId } from "@/lib/config/admin-id";
import { adminRoutes } from "@/lib/routes";

/**
 * The frame of the webmail. It is not the admin shell: the three panes need the
 * whole window, so there is no sidebar here, only the header and one `main`.
 * Without a session it redirects to sign-in before anything renders. It keeps
 * the contract of every frame in the panel: the skip link first, one `main`,
 * a named region per pane, no inline style.
 */
export default async function MailLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await requireSession();
	// The way into the administration exists only for an admin session, in an
	// installation whose admin area is on; its address, id included, is built here.
	const adminId = session.role === "admin" ? await readAdminId() : undefined;

	return (
		<QueryProvider>
			<div className="flex h-dvh flex-col bg-muted">
				<SkipLink />
				<MailHeader
					name={session.sub}
					adminHref={
						adminId === undefined
							? undefined
							: adminRoutes(adminId).home
					}
				/>
				<main
					id="main-content"
					className="min-h-0 flex-1 overflow-hidden"
				>
					{children}
				</main>
			</div>
			<AppToaster />
		</QueryProvider>
	);
}
