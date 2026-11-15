import { InboxIcon, ShieldIcon, SlidersHorizontalIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { SidebarGroup } from "@/components/ui/sidebar/group";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import { PUBLIC_ROUTES } from "@/lib/routes";

/**
 * The navigation of the preferences page's sidebar: the way back to the mail
 * area, the way into the administration when the server gave one (an admin
 * session in an installation whose admin area is on), and the page itself,
 * marked as the current one. The page belongs to neither area, so it has no
 * folders and no admin pages of its own to list.
 */
export async function MeNav({
	adminHref,
}: {
	/** The address of the administration, built on the server for an admin session only. */
	adminHref?: Route | undefined;
}) {
	const t = await getTranslations("nav");
	const current = t("currentEntry", { name: t("preferences") });

	return (
		<SidebarGroup>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton asChild tooltip={t("mail")}>
						<Link href={PUBLIC_ROUTES.mail}>
							<InboxIcon aria-hidden="true" />
							<span>{t("mail")}</span>
						</Link>
					</SidebarMenuButton>
				</SidebarMenuItem>
				{adminHref === undefined ? null : (
					<SidebarMenuItem>
						<SidebarMenuButton
							asChild
							tooltip={t("administration")}
						>
							<Link href={adminHref}>
								<ShieldIcon aria-hidden="true" />
								<span>{t("administration")}</span>
							</Link>
						</SidebarMenuButton>
					</SidebarMenuItem>
				)}
				<SidebarMenuItem>
					<SidebarMenuButton asChild isActive tooltip={current}>
						<Link href={PUBLIC_ROUTES.me} aria-current="page">
							<SlidersHorizontalIcon aria-hidden="true" />
							<span>{t("preferences")}</span>
						</Link>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarGroup>
	);
}
