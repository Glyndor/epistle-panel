"use client";

import { LanguagesIcon } from "lucide-react";
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
import { SidebarMenuButton } from "@/components/ui/sidebar/menu";
import { setLocale } from "@/features/locale/actions/set-locale";
import { localeSchema } from "@/features/locale/schemas/locale";
import { SUPPORTED_LOCALES } from "@/i18n/locales";

/** Message key of each locale's own name. */
const LOCALE_LABELS = { en: "languageEn", es: "languageEs" } as const;

/**
 * The language menu itself, with the Radix menu code it needs. It is loaded on
 * demand by `LanguageSwitcher`, so the page does not carry that code until
 * someone reaches for the menu. The locale is validated here with the shared
 * schema and again by the Server Action, which is the real gate.
 */
export function LanguageMenu({
	defaultOpen,
}: {
	/** Open straight away: the person pressed the placeholder before the code had loaded. */
	defaultOpen: boolean;
}) {
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
		<DropdownMenu defaultOpen={defaultOpen}>
			<DropdownMenuTrigger asChild>
				<SidebarMenuButton tooltip={t("language")} aria-busy={pending}>
					<LanguagesIcon aria-hidden="true" />
					<span>{t("language")}</span>
				</SidebarMenuButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent side="top" align="start">
				<DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
				<DropdownMenuRadioGroup value={current} onValueChange={choose}>
					{SUPPORTED_LOCALES.map((code) => (
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
	);
}
