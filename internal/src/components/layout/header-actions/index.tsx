import { LogOutIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { UserMenu } from "@/components/layout/user-menu";
import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions/logout";
import { ThemeSwitcher } from "@/features/theme/components/theme-switcher";
import type { SessionRole } from "@/lib/auth/session";

/**
 * The far end of a header, the same in the admin area and in the webmail: the
 * theme button and the profile menu. Everything in it comes from the session
 * the layout already checked: the account's name, its role and, for an admin
 * session only, the address of the administration built on the server.
 *
 * The menu needs script. Without it the two things nobody can do without stay
 * reachable: the way into the administration and sign out, a plain link and a
 * plain form, here in a `noscript`. They take room the menu does not, so this
 * end wraps under the rest of the bar where the window is narrow.
 */
export function HeaderActions({
	name,
	sessionRole,
	adminHref,
}: {
	name: string;
	sessionRole: SessionRole;
	adminHref?: string | undefined;
}) {
	const t = useTranslations("nav");

	return (
		<div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
			<ThemeSwitcher />
			<UserMenu
				name={name}
				sessionRole={sessionRole}
				adminHref={adminHref}
			/>
			<noscript>
				<span className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
					{adminHref === undefined ? null : (
						<Button asChild variant="ghost">
							<a href={adminHref}>{t("administration")}</a>
						</Button>
					)}
					<form action={logout}>
						<Button type="submit" variant="ghost">
							<LogOutIcon aria-hidden="true" />
							{t("logout")}
						</Button>
					</form>
				</span>
			</noscript>
		</div>
	);
}
