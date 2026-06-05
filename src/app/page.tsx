import { getTranslations } from "next-intl/server";

export default async function HomePage() {
	const t = await getTranslations("home");
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-4 p-8">
			<h1 className="font-semibold text-3xl">{t("heading")}</h1>
			<p className="text-lg">{t("tagline")}</p>
			<p className="text-zinc-500">{t("status-pending")}</p>
		</main>
	);
}
