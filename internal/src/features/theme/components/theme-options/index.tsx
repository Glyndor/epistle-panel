import { MonitorIcon, MoonIcon, PaletteIcon, SunIcon } from "lucide-react";
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

/** The icon of each choice, the same the theme button of the header shows for it. */
const ICONS = {
	system: MonitorIcon,
	light: SunIcon,
	dark: MoonIcon,
} as const satisfies Record<ThemeChoice, unknown>;

/**
 * The theme choices as the radio items of a menu, each with its icon, the
 * current one checked.
 * Every menu that offers the theme renders this, with the state of
 * `useThemeChoice`, so there is one list and one way to change it.
 */
export function ThemeOptions({
	choice,
	onChoose,
	disabled = false,
}: {
	choice: ThemeChoice;
	onChoose: (value: string) => void;
	/** A choice is being stored: the items wait for it. */
	disabled?: boolean;
}) {
	const t = useTranslations("nav");

	return (
		<>
			<DropdownMenuLabel>
				<PaletteIcon aria-hidden="true" />
				{t("theme")}
			</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				aria-label={t("theme")}
				value={choice}
				onValueChange={onChoose}
			>
				{THEME_CHOICES.map((value) => {
					const Icon = ICONS[value];
					return (
						<DropdownMenuRadioItem
							key={value}
							value={value}
							disabled={disabled}
						>
							<Icon aria-hidden="true" />
							{t(`theme_${value}`)}
						</DropdownMenuRadioItem>
					);
				})}
			</DropdownMenuRadioGroup>
		</>
	);
}
