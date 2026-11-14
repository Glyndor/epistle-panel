"use client";

import { useTranslations } from "next-intl";
import { useLazyPanel } from "@/components/layout/lazy-panel";
import { ThemeTrigger } from "@/features/theme/components/theme-trigger";
import { useDocumentTheme } from "@/features/theme/hooks/use-theme-choice";

const loadMenu = () =>
	import("@/features/theme/components/theme-menu").then(
		(module) => module.ThemeMenu,
	);

/**
 * The theme button of a header: light, dark or the system's. Until someone
 * hovers, focuses or presses it, it is a plain button with the look of the
 * real trigger, so the page carries none of the menu code and nothing moves
 * when the menu arrives. Hover and focus only warm the download; a press swaps
 * in the real menu already open. Opened with the pointer the menu takes the
 * focus; opened from the keyboard (Enter, Space or the down arrow) its first
 * item does. Closing it returns the
 * focus to the button. If the code cannot be fetched the button stays, a
 * toast says so and the next press tries again.
 */
export function ThemeSwitcher() {
	const t = useTranslations("nav");
	const current = useDocumentTheme();
	const menu = useLazyPanel(loadMenu, t("menuFailed"));

	if (menu.panel !== undefined) {
		const Menu = menu.panel;
		return <Menu defaultOpen focusFirstItem={menu.press === "keyboard"} />;
	}
	return (
		<ThemeTrigger
			choice={current}
			aria-haspopup="menu"
			aria-expanded="false"
			aria-busy={menu.loading}
			{...menu.trigger}
		/>
	);
}
