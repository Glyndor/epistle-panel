"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import { useAdminRoutes } from "@/components/layout/admin-routes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAccountsAction } from "@/features/accounts/actions/get-accounts";
import { AccountsTableSkeleton } from "@/features/accounts/components/accounts-table-skeleton";
import { accountsQueryOptions } from "@/features/accounts/queries/accounts-query";
import type { AccountRow } from "@/features/accounts/schemas/accounts-view";
import { isAccountName } from "@/lib/api/account-name-pattern";
import { unwrap } from "@/lib/query/action-result";

const fetchAccounts = async () => unwrap(await getAccountsAction());
const getRowId = (row: AccountRow) => row.name;
const helper = columnHelper<AccountRow>();

/**
 * An account's name, linked to its page when it is a name the page accepts. The
 * rule is the page's own, so a name it would answer 404 for is not offered.
 */
function AccountName({ name }: { name: string }) {
	const routes = useAdminRoutes();
	return isAccountName(name) ? (
		<Link
			href={routes.accountDetail(name)}
			className="break-all rounded-sm font-semibold text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
		>
			{name}
		</Link>
	) : (
		<span className="break-all font-semibold">{name}</span>
	);
}

/** The accounts table: sortable by account, filterable over names and addresses. */
export function AccountsTable() {
	const t = useTranslations("accounts");
	const { data, isPending } = useQuery(accountsQueryOptions(fetchAccounts));
	const columns = helper.columns([
		helper.accessor("name", {
			header: t("name"),
			cell: (info) => <AccountName name={info.getValue()} />,
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
		return <AccountsTableSkeleton />;
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
