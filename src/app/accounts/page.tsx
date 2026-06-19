import { getTranslations } from "next-intl/server";

import { UnreachableNotice } from "@/components/unreachable-notice";
import { getAccounts } from "@/lib/api/client";
import type { Accounts } from "@/lib/api/schemas";

async function loadAccounts(): Promise<Accounts["accounts"] | null> {
	try {
		return (await getAccounts()).accounts;
	} catch (error) {
		console.error("accounts fetch failed:", error);
		return null;
	}
}

export default async function AccountsPage() {
	const t = await getTranslations("accounts");
	const accounts = await loadAccounts();

	return (
		<main
			id="main-content"
			className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8"
		>
			<h1 className="font-semibold text-3xl">{t("heading")}</h1>
			{accounts === null ? (
				<UnreachableNotice message={t("unreachable")} />
			) : accounts.length === 0 ? (
				<p className="text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
			) : (
				<ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
					{accounts.map((account) => (
						<li
							key={account.name}
							className="flex flex-col gap-1 p-4"
						>
							<span className="font-semibold">
								{account.name}
							</span>
							<span className="break-all font-mono text-sm text-zinc-500 dark:text-zinc-400">
								{account.addresses.join(", ")}
							</span>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}
