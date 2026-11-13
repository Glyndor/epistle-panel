"use client";

import { LogOutIcon, ShieldIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { UserTrigger } from "@/components/layout/user-trigger";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logout } from "@/features/auth/actions/logout";
import { LanguageOptions } from "@/features/locale/components/language-options";
import { useLocaleChoice } from "@/features/locale/hooks/use-locale-choice";
import { ThemeOptions } from "@/features/theme/components/theme-options";
import { useThemeChoice } from "@/features/theme/hooks/use-theme-choice";
import type { SessionRole } from "@/lib/auth/session";
import { useFirstItemFocus } from "@/lib/first-item-focus";

/**
 * The profile menu itself, with the Radix menu code it needs: who is signed
 * in and as what, the language, the theme, the way into the administration
 * when the server gave one, and sign out. `UserMenu` loads it on demand.
 */
export function UserMenuPanel({
	name,
	sessionRole,
	adminHref,
	defaultOpen,
	focusFirstItem = false,
}: {
	name: string;
	sessionRole: SessionRole;
	/** The address of the administration, built on the server for an admin session only. */
	adminHref?: string | undefined;
	/** Open straight away: the person pressed the placeholder before the code had loaded. */
	defaultOpen: boolean;
	/** With `defaultOpen`, put the focus on the first item, as a menu opened from the keyboard does. */
	focusFirstItem?: boolean;
}) {
	const t = useTranslations("nav");
	const language = useLocaleChoice();
	const theme = useThemeChoice();
	const [leaving, startLeaving] = useTransition();
	const content = useFirstItemFocus(defaultOpen && focusFirstItem);
	// One choice at a time: a second one waits for the first to be stored.
	const storing = language.pending || theme.pending;

	return (
		<DropdownMenu defaultOpen={defaultOpen}>
			<DropdownMenuTrigger asChild>
				<UserTrigger name={name} aria-busy={storing || leaving} />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				ref={content}
				align="end"
				collisionPadding={8}
				className="max-h-(--radix-dropdown-menu-content-available-height) w-56 max-w-[calc(100vw-1rem)] overflow-y-auto"
			>
				<DropdownMenuLabel className="flex flex-col gap-0.5">
					<span className="break-all font-medium text-foreground text-sm">
						{name}
					</span>
					<span>{t(`role_${sessionRole}`)}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<LanguageOptions
					locale={language.locale}
					onChoose={language.choose}
					disabled={storing}
				/>
				<DropdownMenuSeparator />
				<ThemeOptions
					choice={theme.choice}
					onChoose={theme.choose}
					disabled={storing}
				/>
				<DropdownMenuSeparator />
				{adminHref === undefined ? null : (
					<DropdownMenuItem asChild>
						<a href={adminHref}>
							<ShieldIcon aria-hidden="true" />
							{t("administration")}
						</a>
					</DropdownMenuItem>
				)}
				<DropdownMenuItem
					onSelect={() =>
						startLeaving(async () => {
							await logout();
						})
					}
				>
					<LogOutIcon aria-hidden="true" />
					{t("logout")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
