import "server-only";

import { getTranslations } from "next-intl/server";

import type { LegendItem } from "@/components/charts/chart-legend";
import type { SeriesIndex } from "@/components/charts/series";
import type { SkeletonWords } from "@/features/overview/components/chart-card-skeleton";
import type { OverviewPeriod } from "@/features/overview/schemas/overview-input";
import { DELIVERY_OUTCOMES } from "@/lib/api/schemas";

/** The words the four chart skeletons are written with. */
export interface OverviewSkeletonWords {
	outcomes: SkeletonWords;
	timeline: SkeletonWords;
	queue: SkeletonWords;
	suppression: SkeletonWords;
	/** The line under the timeline's title, with a time of four zeros where the reading's will be. */
	timelineNote: string;
	/** The entries of the timeline's legend: the outcomes, in the order they stack. */
	legend: LegendItem[];
	/** The words of the button that shows a chart's table. */
	viewData: string;
}

/**
 * Read the words of the chart cards that need no data: titles, the links at
 * the end of the title rows, the legend of the outcomes, the button of the
 * tables and, for the period, the line under the timeline's title. The page and its loading state both write their skeletons with
 * them, so the two draw the same frame and it is the frame of the cards.
 */
export async function skeletonWords(
	period: OverviewPeriod,
): Promise<OverviewSkeletonWords> {
	const [t, tLog] = await Promise.all([
		getTranslations("overview"),
		getTranslations("deliveries"),
	]);
	const log = t("deliveries.open");
	return {
		outcomes: { title: t("outcomes.title"), action: log },
		timeline: { title: t("timeline.title"), action: log },
		queue: { title: t("queue.title"), action: t("queue.open") },
		suppression: {
			title: t("suppression.title"),
			action: t("suppression.open"),
		},
		timelineNote: t(`timeline.note.${period === "24h" ? "hour" : "day"}`, {
			time: "00:00",
		}),
		legend: DELIVERY_OUTCOMES.map((outcome, index) => ({
			key: outcome,
			label: tLog(`outcomes.${outcome}`),
			series: index as SeriesIndex,
		})),
		viewData: t("viewData"),
	};
}
