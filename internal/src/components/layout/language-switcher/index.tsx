"use client";

import { LanguagesIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { lazy, Suspense, useState } from "react";

import { SidebarMenuButton } from "@/components/ui/sidebar/menu";

const loadMenu = () => import("@/components/layout/language-menu");
const LanguageMenu = lazy(() =>
	loadMenu().then((module) => ({ default: module.LanguageMenu })),
);

/**
 * The language entry of the sidebar footer. Until someone hovers, focuses or
 * presses it, it is a plain button with the same size and look as the real
 * trigger, so the page carries none of the menu code and nothing moves when the
 * menu arrives. Hover and focus only warm the download; a press (or Enter)
 * swaps in the real menu already open; the menu takes the focus, and closing
 * it returns the focus to the trigger.
 */
export function LanguageSwitcher() {
	const t = useTranslations("nav");
	const [pressed, setPressed] = useState(false);

	const placeholder = (
		<SidebarMenuButton
			tooltip={t("language")}
			aria-haspopup="menu"
			aria-expanded="false"
			onPointerEnter={() => void loadMenu()}
			onFocus={() => void loadMenu()}
			onClick={() => setPressed(true)}
		>
			<LanguagesIcon aria-hidden="true" />
			<span>{t("language")}</span>
		</SidebarMenuButton>
	);

	if (!pressed) {
		return placeholder;
	}
	return (
		<Suspense fallback={placeholder}>
			<LanguageMenu defaultOpen />
		</Suspense>
	);
}
