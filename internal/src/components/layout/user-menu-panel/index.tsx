"use client";

import { LogOutIcon, ShieldIcon, SlidersHorizontalIcon } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
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
import { toast } from "@/components/ui/toaster";
import { logout } from "@/features/auth/actions/logout";
import { ThemeOptions } from "@/features/theme/components/theme-options";
import { useThemeChoice } from "@/features/theme/hooks/use-theme-choice";
import type { SessionRole } from "@/lib/auth/session";
import { useFirstItemFocus } from "@/lib/first-item-focus";
import { PUBLIC_ROUTES } from "@/lib/routes";

/**
 * The profile menu itself, with the Radix menu code it needs: who is signed
 * in and as what, the theme (one click, as in the header), the way into the
 * preferences page, where the language and the rest are chosen, the way into
 * the administration when the server gave one, and sign out. `UserMenu` loads it on demand.
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
	const theme = useThemeChoice();
	const [leaving, startLeaving] = useTransition();
	const content = useFirstItemFocus(defaultOpen && focusFirstItem);
	// One thing at a time in this menu: while a choice is being stored, or the
	// session is being ended, the rows wait.
	const busy = theme.pending || leaving;

	return (
		<DropdownMenu defaultOpen={defaultOpen}>
			<DropdownMenuTrigger asChild>
				<UserTrigger name={name} aria-busy={busy} />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				ref={content}
				align="end"
				collisionPadding={8}
				className="max-h-(--radix-dropdown-menu-content-available-height) w-56 max-w-[calc(100vw-1rem)] overflow-y-auto"
			>
				<DropdownMenuLabel className="flex-col items-start gap-0.5">
					<span className="break-all font-medium text-foreground text-sm">
						{name}
					</span>
					<span>{t(`role_${sessionRole}`)}</span>
				</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<ThemeOptions
					choice={theme.choice}
					onChoose={theme.choose}
					disabled={busy}
				/>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href={PUBLIC_ROUTES.me}>
						<SlidersHorizontalIcon aria-hidden="true" />
						{t("preferences")}
					</Link>
				</DropdownMenuItem>
				{adminHref === undefined ? null : (
					<DropdownMenuItem asChild>
						<a href={adminHref}>
							<ShieldIcon aria-hidden="true" />
							{t("administration")}
						</a>
					</DropdownMenuItem>
				)}
				<DropdownMenuItem
					disabled={busy}
					onSelect={() =>
						startLeaving(async () => {
							try {
								await logout();
							} catch (error) {
								// A sign-out that worked ends in a redirect, which
								// arrives here as the framework's own error and goes
								// on its way. Anything else is a request that failed:
								// the person is still signed in, and is told so, on
								// the page they were on.
								unstable_rethrow(error);
								toast.error(t("logoutFailed"));
							}
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
