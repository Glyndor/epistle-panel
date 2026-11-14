import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import type * as React from "react";

import { Button } from "@/components/ui/button";
import type { ThemeChoice } from "@/features/theme/config/choices";
import { cn } from "@/lib/class-names";

const ICONS = {
	system: MonitorIcon,
	light: SunIcon,
	dark: MoonIcon,
} as const satisfies Record<ThemeChoice, React.ComponentType>;

/**
 * The button of the theme menu: an icon for the current choice and a name
 * that says it ("Theme: Dark"), so the state is not the icon alone. It is the
 * same element before and after the menu code loads, so nothing moves. While
 * its menu is loading or the choice is being stored it is marked busy, and
 * looks it: what is inside fades, the button itself does not. With the whole
 * button at 60% its focus outline measured 2.14:1 against the bar in the
 * light theme, under the 3:1 a focus indicator needs.
 */
export function ThemeTrigger({
	choice,
	className,
	...props
}: Omit<React.ComponentProps<typeof Button>, "children"> & {
	choice: ThemeChoice;
}) {
	const t = useTranslations("nav");
	const Icon = ICONS[choice];

	return (
		<Button
			variant="ghost"
			size="icon"
			data-theme-choice={choice}
			className={cn(
				"aria-expanded:bg-accent aria-expanded:text-accent-foreground aria-busy:cursor-progress aria-busy:*:opacity-70",
				className,
			)}
			{...props}
		>
			<Icon aria-hidden="true" />
			<span className="sr-only">
				{t("themeCurrent", { theme: t(`theme_${choice}`) })}
			</span>
		</Button>
	);
}
