import { LogOutIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { logout } from "@/features/auth/actions/logout";
import { getBrand } from "@/features/branding/queries/brand";
import { LanguageSelect } from "@/features/mail/components/language-select";
import { ThemeSwitcher } from "@/features/theme/components/theme-switcher";

/**
 * The bar above the webmail: the product name, the page's one `h1`, the
 * way into the administration (admin sessions only), the theme, the language
 * and sign out (a plain form, so it works before any script has loaded). The three panes below have their own named regions.
 */
export async function MailHeader({
	name,
	adminHref,
}: {
	name: string;
	/** The way into the administration, for an admin session only. */
	adminHref?: string | undefined;
}) {
	const t = await getTranslations("mail");

	return (
		<header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1">
			<span className="font-semibold text-sm">{getBrand().name}</span>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<div className="ml-auto flex flex-wrap items-center gap-3">
				<p className="hidden text-muted-foreground text-xs md:block">
					{t("signedInAs", { name })}
				</p>
				{adminHref === undefined ? null : (
					<Button asChild variant="ghost" size="sm">
						<a href={adminHref}>{t("admin")}</a>
					</Button>
				)}
				<ThemeSwitcher />
				<LanguageSelect />
				<form action={logout}>
					<Button type="submit" variant="ghost" size="sm">
						<LogOutIcon aria-hidden="true" />
						{/* The words leave on a narrow window so the theme
						    button did not cost the bar a third line; the
						    name stays. */}
						<span className="sr-only sm:not-sr-only">
							{t("signOut")}
						</span>
					</Button>
				</form>
			</div>
		</header>
	);
}
