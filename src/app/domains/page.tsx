import { getTranslations } from "next-intl/server";

import { UnreachableNotice } from "@/components/unreachable-notice";
import { getDomains } from "@/lib/api/client";

async function loadDomains(): Promise<string[] | null> {
	try {
		return (await getDomains()).domains;
	} catch (error) {
		console.error("domains fetch failed:", error);
		return null;
	}
}

export default async function DomainsPage() {
	const t = await getTranslations("domains");
	const domains = await loadDomains();

	return (
		<main
			id="main-content"
			className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8"
		>
			<h1 className="font-semibold text-3xl">{t("heading")}</h1>
			{domains === null ? (
				<UnreachableNotice message={t("unreachable")} />
			) : domains.length === 0 ? (
				<p className="text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
			) : (
				<ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
					{domains.map((domain) => (
						<li
							key={domain}
							className="break-all p-4 font-mono text-sm"
						>
							{domain}
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
