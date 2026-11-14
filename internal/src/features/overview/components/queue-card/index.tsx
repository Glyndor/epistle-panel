import type { Route } from "next";
import { getFormatter, getTranslations } from "next-intl/server";

import { BarList } from "@/components/charts/bar-list";
import {
	ChartCard,
	ChartFigure,
	ChartImage,
	ChartNote,
} from "@/components/charts/chart-card";
import { ChartData } from "@/components/charts/chart-data";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { CardLink } from "@/features/overview/components/card-link";
import {
	CardEmpty,
	CardUnavailable,
} from "@/features/overview/components/card-states";
import { BarListBodyPlace } from "@/features/overview/components/chart-card-skeleton";
import { requestQueueOverview } from "@/features/overview/queries/load-queue-overview";

const ID = "overview-queue";

/**
 * The outbound queue by how long each message has waited: under an hour, 1 to
 * 6 hours, 6 to 24 hours, a day or more. The API gives a queued message no
 * date and no count of attempts; its id is a UUID of version 7, which carries
 * the moment the message was accepted, and that is what the waiting time is
 * read from. A message whose id carries no time is counted apart.
 *
 * Drawn on the server from the queue itself, read to a ceiling: past it the
 * card says that the messages it did not read are newer.
 */
export async function QueueCard({
	queuePath,
	className,
}: {
	/** The queue page's path. */
	queuePath: Route;
	className?: string | undefined;
}) {
	const [overview, t, format] = await Promise.all([
		requestQueueOverview(),
		getTranslations("overview"),
		getFormatter(),
	]);
	const frame = {
		id: ID,
		title: t("queue.title"),
		action: <CardLink href={queuePath} label={t("queue.open")} />,
		className,
	};
	// A message in place of the chart takes the height the chart would have.
	const place = <BarListBodyPlace rows={4} viewData={t("viewData")} />;
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
	const { ages, capped } = overview;
	if (ages.messages === 0) {
		return (
			<ChartCard {...frame} note={t("queue.recipients", { count: 0 })}>
				<CardEmpty
					place={place}
					title={t("queue.emptyTitle")}
					description={t("queue.empty")}
				/>
			</ChartCard>
		);
	}
	const rows = ages.parts.map((part) => ({
		...part,
		name: t(`queue.ages.${part.age}`),
		countText: format.number(part.count),
		shareText: format.number(part.share / 1000, {
			style: "percent",
			maximumFractionDigits: 1,
		}),
	}));
	return (
		<ChartCard
			{...frame}
			note={t(capped ? "queue.recipientsRead" : "queue.recipients", {
				count: ages.recipients,
			})}
		>
			<ChartFigure
				value={format.number(ages.messages)}
				label={t(capped ? "queue.read" : "queue.waiting", {
					count: ages.messages,
				})}
			/>
			<ChartImage
				id={ID}
				description={t(
					capped ? "queue.descriptionRead" : "queue.description",
					{
						count: ages.messages,
						parts: format.list(
							rows.map((row) =>
								t("part", { count: row.count, name: row.name }),
							),
							{ type: "conjunction" },
						),
					},
				)}
			>
				<BarList
					rows={rows.map((row) => ({
						key: row.age,
						label: row.name,
						value: row.count,
						valueText: row.countText,
						detail: row.shareText,
						quiet: row.age === "unknown",
					}))}
				/>
			</ChartImage>
			{capped ? (
				<ChartNote>
					{t("queue.capped", { count: ages.messages })}
				</ChartNote>
			) : null}
			<ChartData label={t("viewData")}>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead scope="col">{t("queue.age")}</TableHead>
							<TableHead scope="col" className="text-end">
								{t("queue.messages")}
							</TableHead>
							<TableHead scope="col" className="text-end">
								{t("share")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.age} data-age={row.age}>
								<TableHead scope="row" className="font-normal">
									{row.name}
								</TableHead>
								<TableCell className="text-end tabular-nums">
									{row.countText}
								</TableCell>
								<TableCell className="text-end text-muted-foreground tabular-nums">
									{row.shareText}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</ChartData>
		</ChartCard>
	);
}
