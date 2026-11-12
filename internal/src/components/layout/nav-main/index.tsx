"use client";

import {
	GlobeIcon,
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

interface NavItem {
	href: string;
	key: "status" | "domains" | "accounts" | "queue";
	icon: LucideIcon;
}

const ITEMS: readonly NavItem[] = [
	{ href: "/", key: "status", icon: LayoutDashboardIcon },
	{ href: "/domains", key: "domains", icon: GlobeIcon },
	{ href: "/accounts", key: "accounts", icon: UsersIcon },
	{ href: "/queue", key: "queue", icon: InboxIcon },
];

/** Whether `pathname` is the page of `href` or one below it. */
function isActive(href: string, pathname: string): boolean {
	return href === "/"
		? pathname === "/"
		: pathname === href || pathname.startsWith(`${href}/`);
}

/** The panel's primary navigation: icon and label per page, the current one marked. */
export function NavMain() {
	const t = useTranslations("nav");
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();

	return (
		<SidebarGroup>
			<SidebarGroupLabel>{t("manage")}</SidebarGroupLabel>
			<SidebarGroupContent>
				<nav aria-label={t("label")}>
					<SidebarMenu>
						{ITEMS.map(({ href, key, icon: Icon }) => {
							const active = isActive(href, pathname);
							return (
								<SidebarMenuItem key={href}>
									<SidebarMenuButton
										asChild
										isActive={active}
										tooltip={t(key)}
									>
										<Link
											href={href}
											aria-current={
												active ? "page" : undefined
											}
											onClick={() => setOpenMobile(false)}
										>
											<Icon aria-hidden="true" />
											<span>{t(key)}</span>
										</Link>
									</SidebarMenuButton>
								</SidebarMenuItem>
							);
						})}
					</SidebarMenu>
				</nav>
			</SidebarGroupContent>
		</SidebarGroup>
	);
}
