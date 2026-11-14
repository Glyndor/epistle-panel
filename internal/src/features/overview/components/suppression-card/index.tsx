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
import { requestSuppressionOverview } from "@/features/overview/queries/load-suppression-overview";

const ID = "overview-suppression";

/**
 * The global suppression list by the domain of each address: the five domains
 * with the most suppressed addresses and the rest as one row. The API lists
 * addresses only, with no reason and no date, so the domain is the one split
 * the data allows: it says which provider's recipients the server has stopped
 * sending to.
 *
 * Drawn on the server from the list itself, read to a ceiling: past it the
 * card says how many addresses it counted. A domain is text from the mail
 * server's list and is rendered as text.
 */
export async function SuppressionCard({
	suppressionPath,
	className,
}: {
	/** The suppression page's path. */
	suppressionPath: Route;
	className?: string | undefined;
}) {
	const [overview, t, format] = await Promise.all([
		requestSuppressionOverview(),
		getTranslations("overview"),
		getFormatter(),
	]);
	const frame = {
		id: ID,
		title: t("suppression.title"),
		action: (
			<CardLink href={suppressionPath} label={t("suppression.open")} />
		),
		className,
	};
	// A message in place of the chart takes the height the chart would have.
	const place = <BarListBodyPlace rows={6} viewData={t("viewData")} />;
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
	const { domains, capped } = overview;
	if (domains.total === 0) {
		return (
			<ChartCard {...frame}>
				<CardEmpty
					place={place}
					title={t("suppression.emptyTitle")}
					description={t("suppression.empty")}
				/>
			</ChartCard>
		);
	}
	const rows = domains.rows.map((row) => ({
		...row,
		key: row.domain ?? "",
		name: row.domain ?? t("suppression.other"),
		countText: format.number(row.count),
		shareText: format.number(row.share / 1000, {
			style: "percent",
			maximumFractionDigits: 1,
		}),
	}));
	return (
		<ChartCard {...frame}>
			<ChartFigure
				value={format.number(domains.total)}
				label={t(
					capped ? "suppression.read" : "suppression.addresses",
					{
						count: domains.total,
					},
				)}
			/>
			<ChartImage
				id={ID}
				description={t(
					capped
						? "suppression.descriptionRead"
						: "suppression.description",
					{
						count: domains.total,
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
						key: row.key,
						label: row.name,
						value: row.count,
						valueText: row.countText,
						detail: row.shareText,
						quiet: row.domain === null,
					}))}
				/>
			</ChartImage>
			{capped ? (
				<ChartNote>
					{t("suppression.capped", { count: domains.total })}
				</ChartNote>
			) : null}
			<ChartData label={t("viewData")}>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead scope="col">
								{t("suppression.domain")}
							</TableHead>
							<TableHead scope="col" className="text-end">
								{t("suppression.count")}
							</TableHead>
							<TableHead scope="col" className="text-end">
								{t("share")}
							</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{rows.map((row) => (
							<TableRow key={row.key} data-domain={row.key}>
								<TableHead
									scope="row"
									className="break-all font-normal"
								>
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
