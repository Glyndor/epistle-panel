import { getTranslations } from "next-intl/server";

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
			<p className="text-zinc-500 dark:text-zinc-400">{t("body")}</p>
			<a
				href="/"
				className="self-start text-sm text-zinc-600 underline hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-100"
			>
				{t("home")}
			</a>
		</main>
	);
}
