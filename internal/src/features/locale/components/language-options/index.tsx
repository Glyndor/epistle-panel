import { useTranslations } from "next-intl";

import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { LOCALE_NAMES, SUPPORTED_LOCALES } from "@/i18n/locales";

/**
 * The interface languages as the radio items of a menu, each under its own
 * name and marked with its `lang`, the current one checked. The state comes
 * from `useLocaleChoice`.
 */
export function LanguageOptions({
	locale,
	onChoose,
	disabled = false,
}: {
	locale: string;
	onChoose: (value: string) => void;
	/** A choice is being stored: the items wait for it. */
	disabled?: boolean;
}) {
	const t = useTranslations("nav");

	return (
		<>
			<DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				aria-label={t("language")}
				value={locale}
				onValueChange={onChoose}
			>
				{SUPPORTED_LOCALES.map((code) => (
					<DropdownMenuRadioItem
						key={code}
						value={code}
						lang={code}
						disabled={disabled}
					>
						{LOCALE_NAMES[code]}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
		</>
	);
}
