import { getTranslations } from "next-intl/server";

import { UnreachableNotice } from "@/components/unreachable-notice";
import { getQueue } from "@/lib/api/client";
import type { QueuePage as QueuePageData } from "@/lib/api/schemas";

import { RemoveButton } from "./remove-button";

async function loadQueue(cursor?: string): Promise<QueuePageData | null> {
	try {
		return await getQueue(cursor ? { cursor } : undefined);
	} catch (error) {
		console.error("queue fetch failed:", error);
		return null;
	}
}

export default async function QueuePage({
	searchParams,
}: {
	searchParams: Promise<{ cursor?: string }>;
}) {
	const t = await getTranslations("queue");
	const { cursor } = await searchParams;
	const page = await loadQueue(cursor);

	return (
		<main
			id="main-content"
			className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-8"
		>
			<h1 className="font-semibold text-3xl">{t("heading")}</h1>
			{page === null ? (
				<UnreachableNotice message={t("unreachable")} />
			) : page.entries.length === 0 ? (
				<p className="text-zinc-500 dark:text-zinc-400">{t("empty")}</p>
			) : (
				<>
					<ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
						{page.entries.map((entry) => (
							<li
								key={entry.id}
								className="flex items-start justify-between gap-4 p-4"
							>
								<div className="flex min-w-0 flex-col gap-1">
									<span className="break-all font-mono text-sm">
										{t("from")}:{" "}
										{entry.reverse_path || "<>"}
									</span>
									<span className="break-all text-sm text-zinc-500 dark:text-zinc-400">
										{t("to")}: {entry.recipients.join(", ")}
									</span>
								</div>
								<RemoveButton
									id={entry.id}
									recipients={entry.recipients.join(", ")}
								/>
							</li>
						))}
					</ul>
					{page.next_cursor && (
						<a
							href={`/queue?cursor=${encodeURIComponent(page.next_cursor)}`}
							className="self-start text-sm text-zinc-600 underline hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-100"
						>
							{t("next")}
						</a>
					)}
				</>
			)}
		</main>
	);
}
