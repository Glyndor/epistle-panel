"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { getAccountsAction } from "@/features/accounts/actions/get-accounts";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { unwrap } from "@/lib/query/action-result";

const fetchAccounts = async () => unwrap(await getAccountsAction());
const getRowId = (row: AccountRow) => row.name;
const helper = columnHelper<AccountRow>();

/** The accounts table: sortable by account, filterable over names and addresses. */
export function AccountsTable() {
	const t = useTranslations("accounts");
	const { data, isPending } = useQuery(accountsQueryOptions(fetchAccounts));
	const columns = helper.columns([
		helper.accessor("name", {
			header: t("name"),
			cell: (info) => (
				<span className="break-all font-semibold">
					{info.getValue()}
				</span>
			),
		}),
		helper.accessor((row) => row.addresses.join(", "), {
			id: "addresses",
			header: t("addresses"),
			enableSorting: false,
			cell: (info) => (
				<span className="break-all font-mono text-muted-foreground">
					{info.getValue()}
				</span>
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
