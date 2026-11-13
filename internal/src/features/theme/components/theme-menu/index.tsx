"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeOptions } from "@/features/theme/components/theme-options";
import { ThemeTrigger } from "@/features/theme/components/theme-trigger";
import { useThemeChoice } from "@/features/theme/hooks/use-theme-choice";
import { useFirstItemFocus } from "@/lib/first-item-focus";

/**
 * The theme menu itself, with the Radix menu code it needs. `ThemeSwitcher`
 * loads it on demand, so a page does not carry that code until someone
 * reaches for the menu.
 */
export function ThemeMenu({
	defaultOpen,
	focusFirstItem = false,
}: {
	/** Open straight away: the person pressed the placeholder before the code had loaded. */
	defaultOpen: boolean;
	/** With `defaultOpen`, put the focus on the first item, as a menu opened from the keyboard does. */
	focusFirstItem?: boolean;
}) {
	const theme = useThemeChoice();
	const content = useFirstItemFocus(defaultOpen && focusFirstItem);

	return (
		<DropdownMenu defaultOpen={defaultOpen}>
			<DropdownMenuTrigger asChild>
				<ThemeTrigger choice={theme.choice} aria-busy={theme.pending} />
			</DropdownMenuTrigger>
			<DropdownMenuContent ref={content} align="end">
				<ThemeOptions
					choice={theme.choice}
					onChoose={theme.choose}
					disabled={theme.pending}
				/>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
