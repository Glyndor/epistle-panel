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
import { NavSection } from "@/components/layout/nav-section";
import { useSidebar } from "@/components/ui/sidebar/context";
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
 * A surface's primary navigation: icon and label per entry, in groups that
 * open and close under their heading, the current page marked. It draws what
 * the config gave it, so it knows no route. A group that is closed still
 * draws the entry of the current page, so the sidebar always says where the
 * person is.
 */
export function NavMain({ groups }: { groups: readonly NavGroup[] }) {
	const t = useTranslations("nav");
	const pathname = usePathname();
	const { setOpenMobile } = useSidebar();

	const entry = ({ href, label, icon, exact }: NavGroup["items"][number]) => {
		const Icon = ICONS[icon];
		const active = isActive(href, pathname, exact);
		return (
			<SidebarMenuItem key={href}>
				<SidebarMenuButton
					asChild
					isActive={active}
					// On the rail the fill and the mark say which page this
					// is; the tooltip says it in words.
					tooltip={
						active
							? t("currentEntry", { name: t(label) })
							: t(label)
					}
				>
					<Link
						href={href}
						aria-current={active ? "page" : undefined}
						onClick={() => setOpenMobile(false)}
					>
						<Icon aria-hidden="true" />
						<span>{t(label)}</span>
					</Link>
				</SidebarMenuButton>
			</SidebarMenuItem>
		);
	};

	return (
		<nav aria-label={t("label")}>
			{groups.map((group) => {
				const current = group.items.find(({ href, exact }) =>
					isActive(href, pathname, exact),
				);
				return (
					<NavSection
						key={group.label}
						id={group.label}
						label={t(group.label)}
						current={
							current === undefined ? undefined : (
								<SidebarMenu>{entry(current)}</SidebarMenu>
							)
						}
					>
						<SidebarMenu>{group.items.map(entry)}</SidebarMenu>
					</NavSection>
				);
			})}
		</nav>
	);
}
