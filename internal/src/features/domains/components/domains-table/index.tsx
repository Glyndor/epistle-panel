"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import { DataTableFiltersMenu } from "@/components/data-table/filters-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getDomainsAction } from "@/features/domains/actions/get-domains";
import { DomainsTableSkeleton } from "@/features/domains/components/domains-table-skeleton";
import { domainsQueryOptions } from "@/features/domains/queries/domains-query";
import type { DomainRow } from "@/features/domains/schemas/domains-view";
import { unwrap } from "@/lib/query/action-result";

const fetchDomains = async () => unwrap(await getDomainsAction());
const getRowId = (row: DomainRow) => row.name;
const helper = columnHelper<DomainRow>();

/** The values of the state column, which the Filters menu narrows by. */
const stateOf = (row: DomainRow) => (row.disabled ? "disabled" : "active");

/**
 * The domains table: sortable, paged, with a text filter over the names and a
 * facet for the state the server reports (taking mail, or switched off).
 */
export function DomainsTable() {
	const t = useTranslations("domains");
	const { data, isPending } = useQuery(domainsQueryOptions(fetchDomains));
	const columns = helper.columns([
		helper.accessor("name", {
			header: t("name"),
			cell: (info) => (
				<span className="wrap-anywhere font-mono">
					{info.getValue()}
				</span>
			),
		}),
		helper.accessor(stateOf, {
			id: "state",
			header: t("state"),
			// The text filter reads what a row shows; this value is a key.
			enableGlobalFilter: false,
			cell: (info) =>
				info.getValue() === "disabled" ? (
					<Badge variant="muted">{t("stateDisabled")}</Badge>
				) : (
					<Badge variant="secondary">{t("stateActive")}</Badge>
				),
		}),
	]);

	if (isPending) {
		return <DomainsTableSkeleton />;
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
			data={data}
			getRowId={getRowId}
			filterLabel={t("filter")}
			emptyLabel={t("empty")}
			filtersMenu={DataTableFiltersMenu}
			facets={[
				{
					columnId: "state",
					label: t("state"),
					options: [
						{ value: "active", label: t("stateActive") },
						{ value: "disabled", label: t("stateDisabled") },
					],
				},
			]}
		/>
	);
}
