import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { PUBLIC_ROUTES } from "@/lib/routes";

/**
 * Page for a path no route matches. Next's built-in 404 page styles itself
 * with inline `style` attributes and a `<style>` element, which the panel's
 * `style-src 'self'` policy blocks, so the panel renders its own with classes.
 */
export default async function NotFound() {
	const t = await getTranslations("notFound");
	return (
		<main
			id="main-content"
			className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-8"
		>
			<h1 className="font-semibold text-3xl">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("body")}</p>
			<Button asChild variant="link" className="self-start px-0">
				<a href={PUBLIC_ROUTES.root}>{t("start")}</a>
			</Button>{" "}
		</main>
	);
}
