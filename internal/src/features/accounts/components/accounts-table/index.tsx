"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import { DataTableFiltersMenu } from "@/components/data-table/filters-menu";
import { useAdminRoutes } from "@/components/layout/admin-routes";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getAccountsAction } from "@/features/accounts/actions/get-accounts";
import { AccountRowActions } from "@/features/accounts/components/account-row-actions";
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
			className="inline-flex items-center wrap-anywhere rounded-sm font-semibold text-primary underline underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11 pointer-coarse:min-w-11"
		>
			{name}
		</Link>
	) : (
		<span className="wrap-anywhere font-semibold">{name}</span>
	);
}

/** The values of the origin column, which the Filters menu narrows by. */
const originOf = (row: AccountRow): "api" | "file" =>
	row.dynamic ? "api" : "file";

/** Where an account is defined, as a label: the words say it, the tone only helps. */
function OriginBadge({
	origin,
	labels,
	className,
}: {
	origin: "api" | "file";
	labels: Record<"api" | "file", string>;
	className?: string;
}) {
	return (
		<Badge
			variant={origin === "file" ? "muted" : "secondary"}
			className={className}
		>
			{labels[origin]}
		</Badge>
	);
}

/**
 * The accounts table: sortable by account, paged, filterable over names and
 * addresses, with a facet for where an account is defined (made through the
 * API, or declared in the configuration file) and the actions of each account
 * at the end of its row.
 */
export function AccountsTable() {
	const t = useTranslations("accounts");
	const { data, isPending } = useQuery(accountsQueryOptions(fetchAccounts));
	const originLabels = { api: t("originApi"), file: t("originFile") };
	const columns = helper.columns([
		helper.accessor("name", {
			header: t("name"),
			// While the table is narrow the origin column is away and the
			// origin is said here, under the name. There the label may wrap,
			// between its words only: on one line the longer translations
			// made the table wider than a 360 px window and pushed the row's
			// menu out of it. Letting it break inside a word as well made the
			// column narrower than the word and cut "configuración" in two at
			// 360 px, so its longest word stays the floor of the column.
			cell: (info) => (
				<div className="flex flex-col items-start gap-1">
					<AccountName name={info.getValue()} />
					<span className="@md:hidden">
						<OriginBadge
							origin={originOf(info.row.original)}
							labels={originLabels}
							className="shrink whitespace-normal rounded-lg text-start"
						/>
					</span>
				</div>
			),
		}),
		helper.accessor((row) => row.addresses.join(", "), {
			id: "addresses",
			header: t("addresses"),
			enableSorting: false,
			cell: (info) => (
				<span className="wrap-anywhere font-mono text-muted-foreground">
					{info.getValue()}
				</span>
			),
		}),
		helper.accessor(originOf, {
			id: "origin",
			header: t("origin"),
			// The text filter reads what a row shows; this value is a key.
			enableGlobalFilter: false,
			meta: { className: "hidden @md:table-cell" },
			cell: (info) => (
				<OriginBadge origin={info.getValue()} labels={originLabels} />
			),
		}),
		helper.display({
			id: "actions",
			header: () => <span className="sr-only">{t("actions")}</span>,
			cell: (info) => (
				<div className="flex justify-end">
					<AccountRowActions row={info.row.original} />
				</div>
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
			filtersMenu={DataTableFiltersMenu}
			facets={[
				{
					columnId: "origin",
					label: t("origin"),
					options: [
						{ value: "api", label: t("originApi") },
						{ value: "file", label: t("originFile") },
					],
				},
			]}
		/>
	);
}
