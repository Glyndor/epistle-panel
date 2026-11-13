"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import { useAdminRoutes } from "@/components/layout/admin-routes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getQueuePageAction } from "@/features/queue/actions/get-queue-page";
import { RemoveEntryButton } from "@/features/queue/components/remove-entry-button";
import { queueQueryOptions } from "@/features/queue/queries/queue-query";
import type { QueueRow } from "@/features/queue/schemas/queue-view";
import { unwrap } from "@/lib/query/action-result";

const fetchPage = async (cursor: string | undefined) =>
	unwrap(await getQueuePageAction(cursor === undefined ? {} : { cursor }));
const getRowId = (row: QueueRow) => row.id;
const helper = columnHelper<QueueRow>();

/**
 * The outbound queue: sortable, with a text filter over the page on screen, and
 * the API's own cursor for paging (a link to `?cursor=`, so a page can be
 * bookmarked and the back button works). Removing an entry is optimistic.
 */
export function QueueTable({ cursor }: { cursor: string | undefined }) {
	const t = useTranslations("queue");
	const routes = useAdminRoutes();
	const { data, isPending } = useQuery(queueQueryOptions(cursor, fetchPage));
	const columns = helper.columns([
		helper.accessor("from", {
			header: t("from"),
			cell: (info) => (
				<span className="break-all font-mono">{info.getValue()}</span>
			),
		}),
		helper.accessor((row) => row.recipients.join(", "), {
			id: "to",
			header: t("to"),
			cell: (info) => (
				<span className="break-all text-muted-foreground">
					{info.getValue()}
				</span>
			),
		}),
		helper.display({
			id: "actions",
			header: () => <span className="sr-only">{t("actions")}</span>,
			cell: (info) => (
				<div className="-my-1 flex justify-end">
					<RemoveEntryButton
						id={info.row.original.id}
						recipients={info.row.original.recipients.join(", ")}
						cursor={cursor}
					/>
				</div>
			),
		}),
	]);

	if (isPending) {
		return <Skeleton className="h-24" aria-busy="true" />;
	}
	if (data === undefined) {
		return (
			<Alert variant="warning">
				<AlertDescription>{t("unreachable")}</AlertDescription>
			</Alert>
		);
	}
	return (
		<DataTable
			columns={columns}
			data={data.entries}
			getRowId={getRowId}
			filterLabel={t("filter")}
			emptyLabel={t("empty")}
			toolbar={
				<>
					{cursor !== undefined ? (
						<Button asChild variant="link">
							<Link href={routes.queue}>{t("first")}</Link>
						</Button>
					) : null}
					{data.nextCursor !== null ? (
						<Button asChild variant="link">
							<Link
								href={`${routes.queue}?cursor=${encodeURIComponent(data.nextCursor)}`}
							>
								{t("next")}
							</Link>
						</Button>
					) : null}
				</>
			}
		/>
	);
}
