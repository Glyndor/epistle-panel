import { getTranslations } from "next-intl/server";

import { HeaderActions } from "@/components/layout/header-actions";
import { getBrand } from "@/features/branding/queries/brand";
import type { SessionRole } from "@/lib/auth/session";

/**
 * The bar above the webmail: the product name, the page's one `h1` and, at the
 * far end, the theme button and the profile menu (who is signed in, the
 * language, the way into the administration for an admin session, sign out).
 * The three panes below have their own named regions.
 */
export async function MailHeader({
	name,
	sessionRole,
	adminHref,
}: {
	name: string;
	sessionRole: SessionRole;
	/** The way into the administration, for an admin session only. */
	adminHref?: string | undefined;
}) {
	const t = await getTranslations("mail");

	return (
		<header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1">
			<span className="font-semibold text-sm">{getBrand().name}</span>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<HeaderActions
				name={name}
				sessionRole={sessionRole}
				adminHref={adminHref}
			/>
		</header>
	);
}
