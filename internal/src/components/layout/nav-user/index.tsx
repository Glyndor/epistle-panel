"use client";

import { LanguagesIcon, LogOutIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@/components/ui/sidebar/menu";
import { setLocale } from "@/features/locale/actions/set-locale";
import { localeSchema } from "@/features/locale/schemas/locale";
import { SUPPORTED_LOCALES } from "@/i18n/locales";
import { logout } from "@/lib/auth/actions/logout";

/** Message key of each locale's own name. */
const LOCALE_LABELS = { en: "languageEn", es: "languageEs" } as const;
const LOCALES = SUPPORTED_LOCALES;

/**
 * Sidebar footer: who is signed in, the language menu and Sign out. The locale
 * is validated here with the shared schema and again by the Server Action. Sign
 * out is a plain form so it works before the menu code has loaded.
 */
export function NavUser({ name }: { name: string }) {
	const t = useTranslations("nav");
	const current = useLocale();
	const [pending, startTransition] = useTransition();

	const choose = (value: string) => {
		const locale = localeSchema.safeParse(value);
		if (!locale.success || locale.data === current) {
			return;
		}
		startTransition(async () => {
			await setLocale(locale.data);
		});
	};

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
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							tooltip={t("language")}
							aria-busy={pending}
						>
							<LanguagesIcon aria-hidden="true" />
							<span>{t("language")}</span>
						</SidebarMenuButton>
					</DropdownMenuTrigger>
					<DropdownMenuContent side="top" align="start">
						<DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
						<DropdownMenuRadioGroup
							value={current}
							onValueChange={choose}
						>
							{LOCALES.map((code) => (
								<DropdownMenuRadioItem
									key={code}
									value={code}
									lang={code}
								>
									{t(LOCALE_LABELS[code])}
								</DropdownMenuRadioItem>
							))}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
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
