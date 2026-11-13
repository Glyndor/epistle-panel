"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { getDeliveriesAction } from "@/features/deliveries/actions/get-deliveries";
import { DeliveriesTableSkeleton } from "@/features/deliveries/components/deliveries-table-skeleton";
import { deliveriesQueryOptions } from "@/features/deliveries/queries/deliveries-query";
import { formatUtcTime } from "@/features/deliveries/queries/format-time";
import type { DeliveryFilters } from "@/features/deliveries/schemas/deliveries-input";
import type { DeliveryRow } from "@/features/deliveries/schemas/deliveries-view";
import type { DELIVERY_OUTCOMES } from "@/lib/api/schemas";
import { unwrap } from "@/lib/query/action-result";

const fetchDeliveries = async (filters: DeliveryFilters) =>
	unwrap(await getDeliveriesAction(filters));
const getRowId = (row: DeliveryRow) => row.id;
const helper = columnHelper<DeliveryRow>();

/** The badge tone of each outcome; the label always says it in words too. */
const OUTCOME_VARIANT: Record<
	(typeof DELIVERY_OUTCOMES)[number],
	"secondary" | "warning" | "destructive" | "muted"
> = {
	delivered: "secondary",
	deferred: "warning",
	failed: "destructive",
	suppressed: "muted",
	canceled: "muted",
};

/**
 * The delivery log, read only: sortable, with a text filter over the records on
 * screen. The API has no cursor, so what the viewer narrows by is the filter
 * form above the table (outcome, window, recipient), which is part of the URL.
 */
export function DeliveriesTable({ filters }: { filters: DeliveryFilters }) {
	const t = useTranslations("deliveries");
	const { data, isPending } = useQuery(
		deliveriesQueryOptions(filters, fetchDeliveries),
	);
	const columns = helper.columns([
		helper.accessor("time", {
			header: t("time"),
			cell: (info) => (
				<span className="whitespace-nowrap font-mono">
					{formatUtcTime(info.getValue())}
				</span>
			),
		}),
		helper.accessor("outcome", {
			header: t("outcome"),
			cell: (info) => (
				<Badge variant={OUTCOME_VARIANT[info.getValue()]}>
					{t(`outcomes.${info.getValue()}`)}
				</Badge>
			),
		}),
		helper.accessor("recipient", {
			header: t("recipient"),
			cell: (info) => (
				<span className="break-all font-mono">{info.getValue()}</span>
			),
		}),
		helper.accessor("from", {
			header: t("from"),
			cell: (info) => (
				<span className="break-all font-mono">
					{info.getValue() || "<>"}
				</span>
			),
		}),
		helper.accessor((row) => row.account ?? "", {
			id: "account",
			header: t("account"),
			cell: (info) => info.getValue() || t("none"),
		}),
		helper.accessor((row) => row.remote ?? "", {
			id: "remote",
			header: t("remote"),
			cell: (info) => (
				<span className="break-all">
					{info.getValue() || t("none")}
				</span>
			),
		}),
		helper.accessor((row) => row.reply ?? "", {
			id: "reply",
			header: t("reply"),
			cell: (info) => (
				<span className="break-words text-muted-foreground">
					{info.getValue() || t("none")}
				</span>
			),
		}),
		helper.accessor("attempt", { header: t("attempt") }),
	]);

	if (isPending) {
		return <DeliveriesTableSkeleton />;
	}
	if (data === undefined) {
		return (
			<Alert variant="warning">
				<AlertDescription>{t("unreachable")}</AlertDescription>
			</Alert>
		);
	}
	if (data.logDisabled) {
		return (
			<Alert variant="warning">
				<AlertDescription>{t("disabled")}</AlertDescription>
			</Alert>
		);
	}
	return (
		<div className="flex flex-col gap-2">
			<DataTable
				columns={columns}
				data={data.entries}
				getRowId={getRowId}
				filterLabel={t("filter")}
				emptyLabel={t("empty")}
			/>
			{data.full ? (
				<p className="text-muted-foreground">{t("full")}</p>
			) : null}
		</div>
	);
}
