"use client";

import { lazy, Suspense, useState } from "react";

import { ThemeTrigger } from "@/features/theme/components/theme-trigger";
import { useDocumentTheme } from "@/features/theme/hooks/use-theme-choice";

const loadMenu = () => import("@/features/theme/components/theme-menu");
const ThemeMenu = lazy(() =>
	loadMenu().then((module) => ({ default: module.ThemeMenu })),
);

/**
 * The theme button of a header: light, dark or the system's. Until someone
 * hovers, focuses or presses it, it is a plain button with the look of the
 * real trigger, so the page carries none of the menu code and nothing moves
 * when the menu arrives. Hover and focus only warm the download; a press swaps
 * in the real menu already open. Opened with the pointer the menu takes the
 * focus; opened from the keyboard its first item does. Closing it returns the
 * focus to the button.
 */
export function ThemeSwitcher() {
	const current = useDocumentTheme();
	const [pressed, setPressed] = useState<"pointer" | "keyboard">();

	const placeholder = (
		<ThemeTrigger
			choice={current}
			aria-haspopup="menu"
			aria-expanded="false"
			onPointerEnter={() => void loadMenu()}
			onFocus={() => void loadMenu()}
			// A click that Enter or Space made has no pointer behind it.
			onClick={(event) =>
				setPressed(event.detail === 0 ? "keyboard" : "pointer")
			}
		/>
	);

	if (pressed === undefined) {
		return placeholder;
	}
	return (
		<Suspense fallback={placeholder}>
			<ThemeMenu defaultOpen focusFirstItem={pressed === "keyboard"} />
		</Suspense>
	);
}
