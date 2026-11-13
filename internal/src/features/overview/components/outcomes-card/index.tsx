import type { Route } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import {
	ChartCard,
	ChartFigure,
	ChartImage,
	ChartNote,
} from "@/components/charts/chart-card";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import type { SeriesIndex } from "@/components/charts/series";
import { Swatch } from "@/components/charts/swatch";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { DELIVERIES_LIMIT } from "@/features/deliveries/schemas/deliveries-input";
import { CardLink } from "@/features/overview/components/card-link";
import {
	CardEmpty,
	CardUnavailable,
} from "@/features/overview/components/card-states";
import { OutcomesBodyPlace } from "@/features/overview/components/chart-card-skeleton";
import { requestDeliveryOverview } from "@/features/overview/queries/load-delivery-overview";
import type { OverviewPeriod } from "@/features/overview/schemas/overview-input";

const ID = "overview-outcomes";

/**
 * The delivery records of a period by outcome: how many, one thin bar split
 * by outcome and, as its legend, a table with the count and the share of each.
 * Every outcome links to the delivery log filtered by it and by the period.
 *
 * It is drawn on the server from one read of the log. When the log is off, the
 * API does not answer or the period has no record, the card says so in place
 * of a chart; when the answer came back at the API's limit it says the figures
 * are of those records only.
 */
export async function OutcomesCard({
	period,
	logPath,
	className,
}: {
	period: OverviewPeriod;
	/** The delivery log's path. */
	logPath: Route;
	className?: string | undefined;
}) {
	const [overview, t, tLog, format] = await Promise.all([
		requestDeliveryOverview(period),
		getTranslations("overview"),
		getTranslations("deliveries"),
		getFormatter(),
	]);
	const frame = {
		id: ID,
		title: t("outcomes.title"),
		note: t(`inPeriod.${period}`),
		action: (
			<CardLink
				href={`${logPath}?since=${period}` as Route}
				label={t("deliveries.open")}
			/>
		),
		className,
	};
	// A message in place of the chart takes the height the chart would have.
	const place = <OutcomesBodyPlace />;
	if (overview.kind === "unreachable") {
		return (
			<ChartCard {...frame}>
				<CardUnavailable
					place={place}
					title={t("unavailableTitle")}
					description={t("unavailable")}
				/>
			</ChartCard>
		);
	}
	if (overview.kind === "disabled") {
		return (
			<ChartCard {...frame}>
				<CardEmpty
					place={place}
					title={t("deliveries.disabledTitle")}
					description={t("deliveries.disabled")}
				/>
			</ChartCard>
		);
	}
	const { total, parts } = overview.outcomes;
	if (total === 0) {
		return (
			<ChartCard {...frame}>
				<CardEmpty
					place={place}
					title={t("deliveries.emptyTitle")}
					description={t("deliveries.empty")}
				/>
			</ChartCard>
		);
	}
	const rows = parts.map((part, index) => ({
		...part,
		series: index as SeriesIndex,
		name: tLog(`outcomes.${part.outcome}`),
		countText: format.number(part.count),
		shareText: format.number(part.share / 1000, {
			style: "percent",
			maximumFractionDigits: 1,
		}),
	}));
	const description = t("outcomes.description", {
		total,
		parts: format.list(
			rows.map((row) => t("part", { count: row.count, name: row.name })),
			{ type: "conjunction" },
		),
	});
	return (
		<ChartCard {...frame}>
			<ChartFigure
				value={format.number(total)}
				label={t("deliveries.records", { count: total })}
			/>
			<ChartImage id={ID} description={description}>
				<SegmentedBar
					parts={rows.map((row) => ({
						key: row.outcome,
						value: row.count,
						series: row.series,
					}))}
				/>
			</ChartImage>
			{overview.full ? (
				<ChartNote>
					{t("deliveries.full", { limit: DELIVERIES_LIMIT })}
				</ChartNote>
			) : null}
			<div className="-mx-4 -mb-4">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead scope="col">
								{t("outcomes.outcome")}
							</TableHead>
							<TableHead scope="col" className="px-2 text-end">
								{t("outcomes.records")}
							</TableHead>
							<TableHead scope="col" className="ps-2 text-end">
								{t("share")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow
								key={row.outcome}
								data-outcome={row.outcome}
							>
								<TableHead
									scope="row"
									className="font-normal pointer-coarse:py-0"
								>
									<span className="flex items-center gap-2">
										<Swatch series={row.series} />
										<Button
											asChild
											variant="link"
											className="min-h-6 justify-start px-0 py-0 pointer-coarse:px-0"
										>
											<Link
												href={
													`${logPath}?outcome=${row.outcome}&since=${period}` as Route
												}
											>
												{row.name}
											</Link>
										</Button>
									</span>
								</TableHead>
								<TableCell
									className="px-2 text-end tabular-nums pointer-coarse:py-0"
									data-cell="count"
								>
									{row.countText}
								</TableCell>
								<TableCell
									className="ps-2 text-end text-muted-foreground tabular-nums pointer-coarse:py-0"
									data-cell="share"
								>
									{row.shareText}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</ChartCard>
	);
}
