"use client";

import {
	BanIcon,
	GlobeIcon,
	HistoryIcon,
	InboxIcon,
	LayoutDashboardIcon,
	type LucideIcon,
	UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useSidebar } from "@/components/ui/sidebar/context";
import {
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
} from "@/components/ui/sidebar/group";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import type {
	NavGroup,
	NavIconName,
} from "@/features/navigation/schemas/nav-item";

/** The icon each name in the navigation config stands for. */
const ICONS: Record<NavIconName, LucideIcon> = {
	dashboard: LayoutDashboardIcon,
	globe: GlobeIcon,
	users: UsersIcon,
	inbox: InboxIcon,
	ban: BanIcon,
	history: HistoryIcon,
};

/**
 * Whether `pathname` is the page of `href` or one below it. An `exact` entry
 * (the home page, the root of every other path) matches itself only.
 */
function isActive(href: string, pathname: string, exact?: boolean): boolean {
	return exact
		? pathname === href
		: pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * A surface's primary navigation: icon and label per entry, grouped, the
 * current page marked. It draws what the config gave it, so it knows no route.
 */
export function NavMain({ groups }: { groups: readonly NavGroup[] }) {
	const t = useTranslations("nav");
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();

	return (
		<nav aria-label={t("label")}>
			{groups.map((group) => (
				<SidebarGroup key={group.label}>
					<SidebarGroupLabel>{t(group.label)}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{group.items.map(({ href, label, icon, exact }) => {
								const Icon = ICONS[icon];
								const active = isActive(href, pathname, exact);
								return (
									<SidebarMenuItem key={href}>
										<SidebarMenuButton
											asChild
											isActive={active}
											tooltip={t(label)}
										>
											<Link
												href={href}
												aria-current={
													active ? "page" : undefined
												}
												onClick={() =>
													setOpenMobile(false)
												}
											>
												<Icon aria-hidden="true" />
												<span>{t(label)}</span>
											</Link>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			))}
		</nav>
	);
}
