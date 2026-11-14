import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { NavMain } from "@/components/layout/nav-main";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import {
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
} from "@/components/ui/sidebar/regions";
import { Sidebar } from "@/components/ui/sidebar/sidebar";
import { BrandMark } from "@/features/branding/components/brand-mark";
import { CopyrightNotice } from "@/features/branding/components/copyright-notice";
import { getBrand } from "@/features/branding/queries/brand";
import type { NavGroup } from "@/features/navigation/schemas/nav-item";

/**
 * The application sidebar: brand, primary navigation and the copyright notice.
 * Who is signed in, the language and sign out are in the header's profile menu.
 * A Server Component that hands translated strings to the client parts, so the
 * sheet title and the close label are in the user's language.
 */
export async function AppSidebar({
	groups,
	homeHref,
}: {
	groups: readonly NavGroup[];
	homeHref: Route;
}) {
	const t = await getTranslations("nav");
	const brand = getBrand();

	return (
		<Sidebar
			title={t("sheetTitle")}
			description={t("sheetDescription")}
			closeLabel={t("close")}
		>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							tooltip={brand.name}
							className="min-h-10"
						>
							<Link href={homeHref}>
								<BrandMark hasLogo={brand.hasLogo} />
								<span className="grid flex-1 text-left leading-tight">
									<span className="truncate font-semibold">
										{brand.name}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{t("brandSubtitle")}
									</span>
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<NavMain groups={groups} />
			</SidebarContent>
			<SidebarFooter>
				<CopyrightNotice className="px-2 text-muted-foreground text-xs group-data-[collapsible=icon]:sr-only" />
			</SidebarFooter>
		</Sidebar>
	);
}
