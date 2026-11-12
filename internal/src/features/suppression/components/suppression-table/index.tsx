"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getSuppressionPageAction } from "@/features/suppression/actions/get-suppression-page";
import { RemoveAddressButton } from "@/features/suppression/components/remove-address-button";
import { suppressionQueryOptions } from "@/features/suppression/queries/suppression-query";
import type { SuppressionRow } from "@/features/suppression/schemas/suppression-view";
import { unwrap } from "@/lib/query/action-result";

const fetchPage = async (after: string | undefined) =>
	unwrap(
		await getSuppressionPageAction(after === undefined ? {} : { after }),
	);
const getRowId = (row: SuppressionRow) => row.address;
const helper = columnHelper<SuppressionRow>();

/**
 * The global suppression list: sortable, with a text filter over the page on
 * screen, and the API's own cursor for paging (a link to `?after=`, so a page
 * can be bookmarked and the back button works). Removing an address is
 * optimistic.
 */
export function SuppressionTable({ after }: { after: string | undefined }) {
	const t = useTranslations("suppression");
	const { data, isPending } = useQuery(
		suppressionQueryOptions(after, fetchPage),
	);
	const columns = helper.columns([
		helper.accessor("address", {
			header: t("address"),
			cell: (info) => (
				<span className="break-all font-mono">{info.getValue()}</span>
			),
		}),
		helper.display({
			id: "actions",
			header: () => <span className="sr-only">{t("actions")}</span>,
			cell: (info) => (
				<div className="-my-1 flex justify-end">
					<RemoveAddressButton
						address={info.row.original.address}
						after={after}
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
					{after !== undefined ? (
						<Button asChild variant="link">
							<Link href="/suppression">{t("first")}</Link>
						</Button>
					) : null}
					{data.nextCursor !== null ? (
						<Button asChild variant="link">
							<Link
								href={`/suppression?after=${encodeURIComponent(data.nextCursor)}`}
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
