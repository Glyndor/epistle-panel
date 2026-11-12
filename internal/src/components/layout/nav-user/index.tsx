"use client";

import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { LanguageSwitcher } from "@/components/layout/language-switcher";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import { logout } from "@/features/auth/actions/logout";

/**
 * Sidebar footer: who is signed in, the language entry and Sign out. Sign out is
 * a plain form, so it works before any menu code has loaded.
 */
export function NavUser({ name }: { name: string }) {
	const t = useTranslations("nav");
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<p
					className="truncate px-2 py-1 text-muted-foreground text-xs group-data-[collapsible=icon]:sr-only"
					data-slot="nav-user-name"
				>
					{t("signedInAs", { name })}
				</p>
			</SidebarMenuItem>
			<SidebarMenuItem>
				<LanguageSwitcher />
			</SidebarMenuItem>
			<SidebarMenuItem>
				<form action={logout}>
					<SidebarMenuButton type="submit" tooltip={t("logout")}>
						<LogOutIcon aria-hidden="true" />
						<span>{t("logout")}</span>
					</SidebarMenuButton>
				</form>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
