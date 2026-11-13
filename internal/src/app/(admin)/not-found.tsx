import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";

/**
 * What an admin page shows for `notFound()`, such as an account name that is not
 * an account. It renders inside the shell, which already has the page's `main`
 * landmark, so unlike the root `not-found` it must not open a second one. Classes
 * only, for the same reason as the root one: the policy has no inline style.
 */
export default async function AdminNotFound() {
	const t = await getTranslations("notFound");
	return (
		<div className="flex flex-col gap-4">
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground text-sm">{t("body")}</p>
			<Button asChild variant="link" className="self-start px-0">
				<a href={ROUTES.home}>{t("home")}</a>
			</Button>
		</div>
	);
}
