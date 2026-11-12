import { getTranslations } from "next-intl/server";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar/trigger";
import { getBrand } from "@/features/branding/queries/brand";

/**
 * The bar above the page content: the sidebar toggle and, where the sidebar is
 * a sheet, the product name. The page's own heading stays in the page.
 */
export async function SiteHeader() {
	const t = await getTranslations("nav");

	return (
		<header className="flex h-10 shrink-0 items-center gap-2 border-b px-2 pointer-coarse:h-14">
			<SidebarTrigger label={t("toggle")} />
			<Separator orientation="vertical" className="h-4" />
			<span className="font-semibold text-sm md:sr-only">
				{getBrand().name}
			</span>
		</header>
	);
}
