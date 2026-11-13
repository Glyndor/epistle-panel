import { getTranslations } from "next-intl/server";
import { SidebarTrigger } from "@/components/ui/sidebar/trigger";
import { getBrand } from "@/features/branding/queries/brand";
import { ThemeSwitcher } from "@/features/theme/components/theme-switcher";

/**
 * The bar above the page content: the sidebar toggle, the product name where
 * the sidebar is a sheet and, at the far end, the theme button. The page's own
 * heading stays in the page.
 */
export async function SiteHeader() {
	const t = await getTranslations("nav");

	return (
		<header className="flex h-10 shrink-0 items-center gap-2 px-2 pointer-coarse:h-14">
			<SidebarTrigger label={t("toggle")} />
			<span className="font-semibold text-sm md:sr-only">
				{getBrand().name}
			</span>
			<div className="ml-auto flex items-center gap-2">
				<ThemeSwitcher />
			</div>
		</header>
	);
}
