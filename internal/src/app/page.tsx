import { getFormatter, getTranslations } from "next-intl/server";

import { UnreachableNotice } from "@/components/unreachable-notice";
import { getStatus } from "@/lib/api/client";
import type { Status } from "@/lib/api/schemas";

async function loadStatus(): Promise<Status | null> {
	try {
		return await getStatus();
	} catch (error) {
		// Render the unreachable state; never surface error internals to the
		// browser, but keep a server-side trace to debug auth/schema failures.
		console.error("status fetch failed:", error);
		return null;
	}
}

function StatusCard({
	label,
	value,
}: {
	label: string;
	value: string | number;
}) {
	return (
		<div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
			<dt className="text-sm text-zinc-500 dark:text-zinc-400">
				{label}
			</dt>
			<dd className="font-semibold text-2xl">{value}</dd>
		</div>
	);
}

export default async function HomePage() {
	const t = await getTranslations("dashboard");
	const format = await getFormatter();
	const status = await loadStatus();

	return (
		<main
			id="main-content"
			className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 p-8"
		>
			<h1 className="font-semibold text-3xl">{t("heading")}</h1>
			{status === null ? (
				<UnreachableNotice message={t("unreachable")} />
			) : (
				<dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
					<StatusCard label={t("version")} value={status.version} />
					<StatusCard
						label={t("domains")}
						value={format.number(status.domains)}
					/>
					<StatusCard
						label={t("accounts")}
						value={format.number(status.accounts)}
					/>
					<StatusCard
						label={t("queue")}
						value={format.number(status.queue_size)}
					/>
				</dl>
			)}
		</main>
	);
}
