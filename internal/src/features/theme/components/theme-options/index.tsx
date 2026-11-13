import { useTranslations } from "next-intl";

import {
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
	THEME_CHOICES,
	type ThemeChoice,
} from "@/features/theme/config/choices";

/**
 * The theme choices as the radio items of a menu, the current one checked.
 * Every menu that offers the theme renders this, with the state of
 * `useThemeChoice`, so there is one list and one way to change it.
 */
export function ThemeOptions({
	choice,
	onChoose,
}: {
	choice: ThemeChoice;
	onChoose: (value: string) => void;
}) {
	const t = useTranslations("nav");

	return (
		<>
			<DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				aria-label={t("theme")}
				value={choice}
				onValueChange={onChoose}
			>
				{THEME_CHOICES.map((value) => (
					<DropdownMenuRadioItem key={value} value={value}>
						{t(`theme_${value}`)}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
		</>
	);
}
