"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getArchiveAction } from "@/features/account-detail/actions/get-archive";
import { RestoreArchiveButton } from "@/features/account-detail/components/restore-archive-button";
import { SectionCard } from "@/features/account-detail/components/section-card";
import { archiveQueryOptions } from "@/features/account-detail/queries/account-queries";
import {
	fromEpochSeconds,
	MOMENT_FORMAT,
} from "@/features/account-detail/queries/time-format";
import { unwrap } from "@/lib/query/action-result";

/**
 * The archived messages of the account. The archive exists only when the server
 * keeps deleted mail, so its absence is a plain notice and not a warning.
 */
export function ArchiveSection({ name }: { name: string }) {
	const t = useTranslations("accountDetail");
	const format = useFormatter();
	const { data, isPending } = useQuery(
		archiveQueryOptions(name, async () =>
			unwrap(await getArchiveAction({ name })),
		),
	);

	return (
		<SectionCard
			id="archive"
			title={t("archiveTitle")}
			description={t("archiveHelp")}
		>
			{isPending ? (
				<Skeleton className="h-12" aria-busy="true" />
			) : data === undefined ? (
				<Alert variant="warning">
					<AlertDescription>{t("unreachable")}</AlertDescription>
				</Alert>
			) : data.state === "unavailable" ? (
				<Alert role="status">
					<AlertDescription>
						{t("archiveUnavailable")}
					</AlertDescription>
				</Alert>
			) : data.entries.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					{t("archiveEmpty")}
				</p>
			) : (
				<ul className="flex flex-col divide-y">
					{data.entries.map((entry) => (
						<li
							key={entry.id}
							className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
						>
							<span className="break-all text-sm">
								{t("archiveMeta", {
									mailbox: entry.mailbox,
									date: format.dateTime(
										fromEpochSeconds(entry.deletedAt),
										MOMENT_FORMAT,
									),
								})}
							</span>
							<RestoreArchiveButton
								name={name}
								id={entry.id}
								mailbox={entry.mailbox}
							/>
						</li>
					))}
				</ul>
			)}
		</SectionCard>
	);
}
