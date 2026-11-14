import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
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
import { PANEL_VERSION } from "@/lib/panel-version";

/**
 * The sidebar of an area: the brand, the area's own navigation and a foot
 * that stays in place. The panel has no page footer; what one would hold is
 * here: what the area adds (the mail area's storage), the version of the
 * panel and the copyright notice. Who is signed in, the language and sign out
 * are in the header's profile menu.
 *
 * A Server Component that hands translated strings to the client parts, so the
 * sheet title and the close label are in the user's language. Collapsed to
 * icons, the foot's words are kept for a screen reader and not drawn.
 */
export async function AppSidebar({
	homeHref,
	subtitle,
	sheet,
	footer,
	children,
}: {
	homeHref: Route;
	/** What the area is, under the brand's name, already translated. */
	subtitle: string;
	/** How the sidebar is named when it is a sheet, already translated. */
	sheet: { title: string; description: string };
	/** What the area adds to the foot, above the version. */
	footer?: React.ReactNode;
	/** The area's navigation. */
	children: React.ReactNode;
}) {
	const t = await getTranslations("nav");
	const brand = getBrand();

	return (
		<Sidebar
			title={sheet.title}
			description={sheet.description}
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
										{subtitle}
									</span>
								</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>{children}</SidebarContent>
			<SidebarFooter>
				{footer}
				<div className="flex flex-col gap-0.5 px-2 pb-1 text-muted-foreground text-xs group-data-[collapsible=icon]:sr-only">
					<span data-slot="panel-version">
						{t("version", { version: PANEL_VERSION })}
					</span>
					<CopyrightNotice />
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
