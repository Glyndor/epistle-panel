"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { columnHelper, DataTable } from "@/components/data-table";
import { useAdminRoutes } from "@/components/layout/admin-routes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getSuppressionPageAction } from "@/features/suppression/actions/get-suppression-page";
import { RemoveAddressButton } from "@/features/suppression/components/remove-address-button";
import { SuppressionTableSkeleton } from "@/features/suppression/components/suppression-table-skeleton";
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
	const routes = useAdminRoutes();
	const { data, isPending } = useQuery(
		suppressionQueryOptions(after, fetchPage),
	);
	const columns = helper.columns([
		helper.accessor("address", {
			header: t("address"),
			cell: (info) => (
				<span className="wrap-anywhere font-mono">
					{info.getValue()}
				</span>
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
		return <SuppressionTableSkeleton />;
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
			// The API pages this list with its cursor: not a second time here.
			pagination={false}
			toolbar={
				<>
					{after !== undefined ? (
						<Button asChild variant="link">
							<Link href={routes.suppression}>{t("first")}</Link>
						</Button>
					) : null}
					{data.nextCursor !== null ? (
						<Button asChild variant="link">
							<Link
								href={`${routes.suppression}?after=${encodeURIComponent(data.nextCursor)}`}
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
