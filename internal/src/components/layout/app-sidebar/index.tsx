import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EpistleMark } from "@/components/icons/epistle-mark";
import { NavMain } from "@/components/layout/nav-main";
import { NavUser } from "@/components/layout/nav-user";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import {
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarSeparator,
} from "@/components/ui/sidebar/regions";
import { Sidebar } from "@/components/ui/sidebar/sidebar";
import type { NavGroup } from "@/features/navigation/schemas/nav-item";

/**
 * The application sidebar: brand, primary navigation and the signed-in user.
 * A Server Component that hands translated strings to the client parts, so the
 * sheet title and the close label are in the user's language.
 */
export async function AppSidebar({
	name,
	groups,
}: {
	name: string;
	groups: readonly NavGroup[];
}) {
	const t = await getTranslations("nav");

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
							tooltip={t("brand")}
							className="min-h-10"
						>
							<Link href="/">
								<EpistleMark />
								<span className="grid flex-1 text-left leading-tight">
									<span className="truncate font-semibold">
										{t("brand")}
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
			<SidebarSeparator />
			<SidebarFooter>
				<NavUser name={name} />
			</SidebarFooter>
		</Sidebar>
	);
}
