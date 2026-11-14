import { getTranslations } from "next-intl/server";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import { loadingRoutes } from "@/features/navigation/queries/loading-routes";
import {
	OutcomesCardSkeleton,
	QueueCardSkeleton,
	SuppressionCardSkeleton,
	TimelineCardSkeleton,
} from "@/features/overview/components/chart-card-skeleton";
import {
	CARD_SPAN,
	DeliveriesSection,
	NowSection,
} from "@/features/overview/components/overview-sections";
import { PeriodNav } from "@/features/overview/components/period-nav";
import { skeletonWords } from "@/features/overview/queries/skeleton-words";
import { DEFAULT_PERIOD } from "@/features/overview/schemas/overview-input";
import { StatusCardsSkeleton } from "@/features/status/components/status-cards-skeleton";
import { PUBLIC_ROUTES } from "@/lib/routes";

/**
 * Shown inside the shell while the status page starts: its real heading, the
 * skeleton its counters stream into and the frame of the charts (headings and
 * period links, which need no data) with a skeleton per card, so nothing moves
 * when they arrive. It is what the page itself sends before the API answers.
 *
 * The status page lives in a route group so that this file is its loading
 * state alone. Next to the layout it was also the first thing every other
 * admin page painted: measured in Chromium against the built server, a load of
 * the domains page showed the Status heading before its own.
 */
export default async function Loading() {
	const routes = await loadingRoutes();
	const t = await getTranslations("dashboard");
	const tCharts = await getTranslations("overview");
	const words = await skeletonWords(DEFAULT_PERIOD);
	return (
		<>
			<AdminBreadcrumbs routes={routes} page="status" />
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<StatusCardsSkeleton />
			<DeliveriesSection
				heading={tCharts("deliveries.heading")}
				nav={
					<PeriodNav
						period={DEFAULT_PERIOD}
						home={routes?.home ?? PUBLIC_ROUTES.root}
						label={tCharts("period.label")}
						names={{
							"24h": tCharts("period.24h"),
							"7d": tCharts("period.7d"),
							"30d": tCharts("period.30d"),
						}}
					/>
				}
			>
				<OutcomesCardSkeleton
					words={words.outcomes}
					className={CARD_SPAN.outcomes}
				/>
				<TimelineCardSkeleton
					words={words.timeline}
					note={words.timelineNote}
					legend={words.legend}
					viewData={words.viewData}
					className={CARD_SPAN.timeline}
				/>
			</DeliveriesSection>
			<NowSection heading={tCharts("now.heading")}>
				<QueueCardSkeleton
					words={words.queue}
					viewData={words.viewData}
				/>
				<SuppressionCardSkeleton
					words={words.suppression}
					viewData={words.viewData}
				/>
			</NowSection>
		</>
	);
}
