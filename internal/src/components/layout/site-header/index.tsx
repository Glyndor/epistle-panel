import { getTranslations } from "next-intl/server";
import { HeaderActions } from "@/components/layout/header-actions";
import { SidebarTrigger } from "@/components/ui/sidebar/trigger";
import { getBrand } from "@/features/branding/queries/brand";
import type { SessionRole } from "@/lib/auth/session";

/**
 * The bar above the page content: the sidebar toggle, the product name where
 * the sidebar is a sheet and, at the far end, the theme button and the profile
 * menu. The page's own heading stays in the page.
 */
export async function SiteHeader({
	user,
	adminHref,
}: {
	/** The account of the session, as the layout read it. */
	user: { name: string; role: SessionRole };
	/** The address of the administration, for an admin session only. */
	adminHref?: string | undefined;
}) {
	const t = await getTranslations("nav");

	return (
		<header className="flex h-10 shrink-0 items-center gap-2 px-2 pointer-coarse:h-14">
			<SidebarTrigger label={t("toggle")} />
			<span className="font-semibold text-sm md:sr-only">
				{getBrand().name}
			</span>
			<HeaderActions
				name={user.name}
				sessionRole={user.role}
				adminHref={adminHref}
			/>
		</header>
	);
}
