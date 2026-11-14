import { getTranslations } from "next-intl/server";
import { HeaderActions } from "@/components/layout/header-actions";
import { SidebarTrigger } from "@/components/ui/sidebar/trigger";
import { getBrand } from "@/features/branding/queries/brand";
import type { SessionRole } from "@/lib/auth/session";

/**
 * The bar above the page content: the sidebar toggle, the product name where
 * the sidebar is a sheet and, at the far end, the theme button and the profile
 * menu. The page's own heading stays in the page. The bar is one row; it
 * wraps instead of pushing the page sideways when its content does not fit,
 * as on a narrow window without script, where the plain link and form of
 * `HeaderActions` are shown as well.
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
		<header className="flex min-h-10 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 px-2 py-1 pointer-coarse:min-h-14">
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
