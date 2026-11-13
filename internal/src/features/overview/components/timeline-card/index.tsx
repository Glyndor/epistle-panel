import type { Route } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import {
	ChartCard,
	ChartImage,
	ChartNote,
} from "@/components/charts/chart-card";
import { ChartData } from "@/components/charts/chart-data";
import { ChartLegend } from "@/components/charts/chart-legend";
import type { SeriesIndex } from "@/components/charts/series";
import { StackedColumns } from "@/components/charts/stacked-columns";
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
import { TimelineBodyPlace } from "@/features/overview/components/chart-card-skeleton";
import { requestDeliveryOverview } from "@/features/overview/queries/load-delivery-overview";
import type { OverviewPeriod } from "@/features/overview/schemas/overview-input";
import { DELIVERY_OUTCOMES } from "@/lib/api/schemas";
import { cn } from "@/lib/class-names";

const ID = "overview-timeline";

/** The palette series of each outcome, in the API's order: the same as the outcomes card. */
const OUTCOME_SERIES: readonly SeriesIndex[] = [0, 1, 2, 3, 4];

/** How many columns apart two labelled columns are, counted back from the newest. */
const LABEL_EVERY = { "7d": 2, "30d": 10 } as const;

/**
 * The delivery records of a period over time: a column per hour of the UTC
 * clock for 24 hours, per UTC day for 7 and 30 days, stacked by outcome in the
 * colours of the outcomes card. Under the drawing, behind a button, the same
 * numbers as a table.
 *
 * When the answer came back at the API's limit, the hours or days it may not
 * have returned are filled with a band and named in the legend. The API does
 * not say whether there was more than its limit, so the card does not either:
 * it says they may be missing, never that they are, and never that they are
 * hours without deliveries.
 */
export async function TimelineCard({
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
		title: t("timeline.title"),
		action: (
			<CardLink
				href={`${logPath}?since=${period}` as Route}
				label={t("deliveries.open")}
			/>
		),
		className,
	};
	const names = DELIVERY_OUTCOMES.map((outcome) =>
		tLog(`outcomes.${outcome}`),
	);
	const legend = DELIVERY_OUTCOMES.map((outcome, index) => ({
		key: outcome,
		label: names[index] ?? outcome,
		series: OUTCOME_SERIES[index] ?? 0,
	}));
	// A message in place of the chart takes the height the chart would have.
	const place = (
		<TimelineBodyPlace legend={legend} viewData={t("viewData")} />
	);
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
	const { timeline, readAt } = overview;
	const at = (seconds: number) => new Date(seconds * 1000);
	const clock = (seconds: number) =>
		format.dateTime(at(seconds), {
			hour: "2-digit",
			minute: "2-digit",
			hourCycle: "h23",
			timeZone: "UTC",
		});
	const day = (seconds: number) =>
		format.dateTime(at(seconds), {
			month: "short",
			day: "numeric",
			timeZone: "UTC",
		});
	const hourly = timeline.unit === "hour";
	const when = (seconds: number) =>
		hourly
			? format.dateTime(at(seconds), {
					month: "short",
					day: "numeric",
					hour: "2-digit",
					minute: "2-digit",
					hourCycle: "h23",
					timeZone: "UTC",
				})
			: day(seconds);
	const note = t(`timeline.note.${timeline.unit}`, { time: clock(readAt) });
	if (timeline.total === 0) {
		return (
			<ChartCard {...frame} note={note}>
				<CardEmpty
					place={place}
					title={t("deliveries.emptyTitle")}
					description={t("deliveries.empty")}
				/>
			</ChartCard>
		);
	}
	const last = timeline.buckets.length - 1;
	const labelled = (index: number, start: number) =>
		hourly
			? (start / 3600) % 6 === 0
			: (last - index) % LABEL_EVERY[period === "30d" ? "30d" : "7d"] ===
				0;
	const busiest = timeline.buckets.reduce((best, bucket) =>
		bucket.total > best.total ? bucket : best,
	);
	// What the pointer is told over a column: its total and, in words, how it
	// splits by outcome, since two colours of the palette can be hard to tell
	// apart for some readers and a column is too narrow to label.
	const hint = (bucket: (typeof timeline.buckets)[number]) => {
		const values = { when: when(bucket.start), count: bucket.total };
		if (bucket.state === "missing") {
			return t("timeline.hintMissing", values);
		}
		if (bucket.total === 0) {
			return t("timeline.hint", values);
		}
		const parts = format.list(
			bucket.counts.flatMap((count, index) =>
				count > 0
					? [t("part", { count, name: names[index] ?? "" })]
					: [],
			),
			{ type: "conjunction" },
		);
		return t(
			bucket.state === "partial"
				? "timeline.hintPartial"
				: "timeline.hintParts",
			{ ...values, parts },
		);
	};
	const incomplete = timeline.buckets.some(
		(bucket) => bucket.state !== "complete",
	);
	return (
		<ChartCard {...frame} note={note}>
			<ChartLegend
				items={[
					...legend,
					...(incomplete
						? [{ key: "missing", label: t("timeline.notReturned") }]
						: []),
				]}
			/>
			<ChartImage
				id={ID}
				description={t("timeline.description", {
					total: timeline.total,
					unit: timeline.unit,
					when: when(busiest.start),
					peak: busiest.total,
				})}
			>
				<StackedColumns
					series={OUTCOME_SERIES}
					formatTick={(value) => format.number(value)}
					columns={timeline.buckets.map((bucket, index) => ({
						key: String(bucket.start),
						values: bucket.counts,
						shaded: bucket.state !== "complete",
						hint: hint(bucket),
						...(labelled(index, bucket.start)
							? {
									label: hourly
										? clock(bucket.start)
										: day(bucket.start),
								}
							: {}),
					}))}
				/>
			</ChartImage>
			{incomplete ? (
				<ChartNote>
					{t("timeline.full", { limit: DELIVERIES_LIMIT })}
				</ChartNote>
			) : null}
			<ChartData label={t("viewData")}>
				<Table scrollLabel={t("timeline.title")}>
					<TableHeader>
						<TableRow>
							<TableHead scope="col">
								{t(`timeline.column.${timeline.unit}`)}
							</TableHead>
							{names.map((name) => (
								<TableHead
									key={name}
									scope="col"
									className="px-2 text-end"
								>
									{name}
								</TableHead>
							))}
							<TableHead scope="col" className="ps-2 text-end">
								{t("timeline.total")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{timeline.buckets.map((bucket) => (
							<TableRow
								key={bucket.start}
								data-state={bucket.state}
							>
								<TableHead
									scope="row"
									className="whitespace-nowrap font-normal"
								>
									{when(bucket.start)}
									{bucket.state === "complete" ? null : (
										<span className="ms-2 text-muted-foreground">
											{t(
												`timeline.state.${bucket.state}`,
											)}
										</span>
									)}
								</TableHead>
								{[...bucket.counts, bucket.total].map(
									(value, index) => (
										<TableCell
											// biome-ignore lint/suspicious/noArrayIndexKey: the outcomes of a row never reorder.
											key={index}
											className={cn(
												"text-end tabular-nums",
												index === bucket.counts.length
													? "ps-2"
													: "px-2",
											)}
										>
											{bucket.state === "missing"
												? tLog("none")
												: format.number(value)}
										</TableCell>
									),
								)}
							</TableRow>
						))}
					</TableBody>
				</Table>
			</ChartData>
		</ChartCard>
	);
}
