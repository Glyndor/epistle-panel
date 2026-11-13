import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions/logout";
import { requireSession } from "@/lib/auth/require-session";
import { readAdminId } from "@/lib/config/admin-id";
import { adminRoutes } from "@/lib/routes";

/**
 * The mail area's page. The mail client is not built yet, so it says so. For a
 * session with the admin role, in an installation whose admin area is on, it
 * also offers the way into the admin panel: that link, and the id in it, are
 * built here on the server and exist for no other session.
 */
export default async function MailPage() {
	const session = await requireSession();
	const t = await getTranslations("mail");
	const adminId = session.role === "admin" ? await readAdminId() : undefined;

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("body")}</p>
			<div className="flex flex-wrap items-center gap-2">
				{adminId !== undefined && (
					<Button asChild>
						<a href={adminRoutes(adminId).home}>{t("admin")}</a>
					</Button>
				)}
				<form action={logout}>
					<Button type="submit" variant="outline">
						{t("logout")}
					</Button>
				</form>
			</div>
		</>
	);
}
