"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { columnHelper, DataTable } from "@/components/data-table";
import type { GlyphName } from "@/components/glyph";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getDeliveriesAction } from "@/features/deliveries/actions/get-deliveries";
import { DeliveriesTableSkeleton } from "@/features/deliveries/components/deliveries-table-skeleton";
import { deliveriesQueryOptions } from "@/features/deliveries/queries/deliveries-query";
import { formatTime } from "@/features/deliveries/queries/format-time";
import type { DeliveryFilters } from "@/features/deliveries/schemas/deliveries-input";
import type { DeliveryRow } from "@/features/deliveries/schemas/deliveries-view";
import { useTimeZone } from "@/features/time-zone/components/time-zone-provider";
import type { DELIVERY_OUTCOMES } from "@/lib/api/schemas";
import { unwrap } from "@/lib/query/action-result";

const fetchDeliveries = async (filters: DeliveryFilters) =>
	unwrap(await getDeliveriesAction(filters));
const getRowId = (row: DeliveryRow) => row.id;
const helper = columnHelper<DeliveryRow>();

/** The drawing of each outcome's badge: no two outcomes share one, so the shape tells them apart as the word does. */
const OUTCOME_GLYPH: Record<(typeof DELIVERY_OUTCOMES)[number], GlyphName> = {
	delivered: "circle-check",
	deferred: "clock",
	failed: "circle-x",
	suppressed: "ban",
	canceled: "circle-minus",
};

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
	const timeZone = useTimeZone();
	const { data, isPending } = useQuery(
		deliveriesQueryOptions(filters, fetchDeliveries),
	);
	const columns = helper.columns([
		helper.accessor("time", {
			header: t("time"),
			cell: (info) => (
				<span className="whitespace-nowrap font-mono">
					{formatTime(info.getValue(), timeZone)}
				</span>
			),
		}),
		helper.accessor("outcome", {
			header: t("outcome"),
			cell: (info) => (
				<StatusBadge
					glyph={OUTCOME_GLYPH[info.getValue()]}
					variant={OUTCOME_VARIANT[info.getValue()]}
				>
					{t(`outcomes.${info.getValue()}`)}
				</StatusBadge>
			),
		}),
		helper.accessor("recipient", {
			header: t("recipient"),
			cell: (info) => (
				<span className="wrap-anywhere font-mono">
					{info.getValue()}
				</span>
			),
		}),
		helper.accessor("from", {
			header: t("from"),
			cell: (info) => (
				<span className="wrap-anywhere font-mono">
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
				<span className="wrap-anywhere">
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
				empty={{ illustration: "tray", description: t("emptyHint") }}
			/>
			{data.full ? (
				<p className="text-muted-foreground">{t("full")}</p>
			) : null}
		</div>
	);
}
