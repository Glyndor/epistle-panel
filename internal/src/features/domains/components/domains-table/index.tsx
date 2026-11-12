"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getDomainsAction } from "@/features/domains/actions/get-domains";
import { domainsQueryOptions } from "@/features/domains/queries/domains-query";
import type { DomainRow } from "@/features/domains/schemas/domains-view";
import { unwrap } from "@/lib/query/action-result";

const fetchDomains = async () => unwrap(await getDomainsAction());
const getRowId = (row: DomainRow) => row.name;
const helper = columnHelper<DomainRow>();

/** The domains table: sortable, with a text filter, fed by the domains query. */
export function DomainsTable() {
	const t = useTranslations("domains");
	const { data, isPending } = useQuery(domainsQueryOptions(fetchDomains));
	const columns = helper.columns([
		helper.accessor("name", {
			header: t("name"),
			cell: (info) => (
				<span className="break-all font-mono">{info.getValue()}</span>
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
			data={data}
			getRowId={getRowId}
			filterLabel={t("filter")}
			emptyLabel={t("empty")}
		/>
	);
}
