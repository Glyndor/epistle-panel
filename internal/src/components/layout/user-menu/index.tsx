"use client";

import { useTranslations } from "next-intl";
import { useLazyPanel } from "@/components/layout/lazy-panel";
import { UserTrigger } from "@/components/layout/user-trigger";
import type { SessionRole } from "@/lib/auth/session";

const loadPanel = () =>
	import("@/components/layout/user-menu-panel").then(
		(module) => module.UserMenuPanel,
	);

/**
 * The profile button of a header. Until someone hovers, focuses or presses
 * it, it is a plain button with the look of the real trigger, so the page
 * carries none of the menu code and nothing moves when the menu arrives.
 * Hover and focus only warm the download; a press swaps in the real menu
 * already open, with the focus on its first item when the press came from
 * the keyboard (Enter, Space or the down arrow). Closing it returns the focus
 * to the button. If the code
 * cannot be fetched the button stays, a toast says so and the next press
 * tries again.
 */
export function UserMenu({
	name,
	sessionRole,
	adminHref,
}: {
	name: string;
	sessionRole: SessionRole;
	/** The address of the administration, built on the server for an admin session only. */
	adminHref?: string | undefined;
}) {
	const t = useTranslations("nav");
	const menu = useLazyPanel(loadPanel, t("menuFailed"));

	if (menu.panel !== undefined) {
		const Panel = menu.panel;
		return (
			<Panel
				name={name}
				sessionRole={sessionRole}
				adminHref={adminHref}
				defaultOpen
				focusFirstItem={menu.press === "keyboard"}
			/>
		);
	}
	return (
		<UserTrigger
			name={name}
			aria-haspopup="menu"
			aria-expanded="false"
			aria-busy={menu.loading}
			{...menu.trigger}
		/>
	);
}
