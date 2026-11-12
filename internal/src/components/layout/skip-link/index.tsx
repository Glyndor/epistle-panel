import { getTranslations } from "next-intl/server";

/** First focusable element of every panel page: jumps past the sidebar to `#main-content`. */
export async function SkipLink() {
	const t = await getTranslations("nav");

	return (
		<a
			href="#main-content"
			className="sr-only rounded bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:inline-flex focus:min-h-11 focus:items-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			{t("skip")}
		</a>
	);
}
