import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
import {
	OutcomesCardSkeleton,
	QueueCardSkeleton,
	SuppressionCardSkeleton,
	TimelineCardSkeleton,
} from "@/features/overview/components/chart-card-skeleton";
import { OutcomesCard } from "@/features/overview/components/outcomes-card";
import { OverviewNotice } from "@/features/overview/components/overview-notice";
import {
	CARD_SPAN,
	DeliveriesSection,
	NowSection,
} from "@/features/overview/components/overview-sections";
import { PeriodNav } from "@/features/overview/components/period-nav";
import { QueueCard } from "@/features/overview/components/queue-card";
import { SuppressionCard } from "@/features/overview/components/suppression-card";
import { TimelineCard } from "@/features/overview/components/timeline-card";
import { requestStatus } from "@/features/overview/queries/request-status";
import { skeletonWords } from "@/features/overview/queries/skeleton-words";
import {
	overviewHref,
	parsePeriodParam,
} from "@/features/overview/schemas/overview-input";
import { StatusCards } from "@/features/status/components/status-cards";
import { StatusCardsSkeleton } from "@/features/status/components/status-cards-skeleton";
import { statusQueryOptions } from "@/features/status/queries/status-query";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetchSpec } from "@/lib/query/prefetch";

/**
 * The status page. The role is checked before anything is sent; the heading
 * and the frame of the charts paint at once. The counters stream in when the
 * API answers, then refresh in the browser. Each chart is drawn on the server
 * and streams in behind its own skeleton, so a slow answer holds one card and
 * not the page.
 *
 * When the API does not answer, the page says so once, at the top, with a
 * link that loads it again. The notice shares the reads of the cards and
 * holds no skeleton: it is there when one of them fails and nothing otherwise.
 *
 * The period of the delivery charts is read from the address before anything
 * is sent. Every part that waits for the API is keyed by it, also the ones
 * whose data does not depend on it: a change of period renders the whole page
 * again on the server, and React keeps the old page on screen until every
 * boundary it already showed has its new content. Measured in a browser with
 * the API at 1.5 s an answer: with only the delivery cards keyed, a click on
 * a period changed nothing for 1.5 s; keyed, the link is marked and the
 * skeletons are there at once.
 */
export default async function HomePage({
	searchParams,
}: {
	searchParams: Promise<{ since?: string | string[] }>;
}) {
	const { routes } = await requireAdmin();
	const t = await getTranslations("dashboard");
	const tCharts = await getTranslations("overview");
	const period = parsePeriodParam((await searchParams).since);
	const words = await skeletonWords(period);

	return (
		<>
			<AdminBreadcrumbs routes={routes} page="status" />
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<Suspense key={`notice-${period}`} fallback={null}>
				<OverviewNotice
					period={period}
					href={overviewHref(routes.home, period)}
				/>
			</Suspense>
			<Suspense
				key={`status-${period}`}
				fallback={<StatusCardsSkeleton />}
			>
				<PrefetchBoundary
					queries={[
						prefetchSpec(
							// Called with no argument, as the notice calls
							// it: React caches a call by its arguments, and
							// the query would pass its context as one.
							statusQueryOptions(() => requestStatus()),
							"status fetch",
						),
					]}
				>
					<StatusCards />
				</PrefetchBoundary>
			</Suspense>
			<DeliveriesSection
				heading={tCharts("deliveries.heading")}
				nav={
					<PeriodNav
						period={period}
						home={routes.home}
						label={tCharts("period.label")}
						names={{
							"24h": tCharts("period.24h"),
							"7d": tCharts("period.7d"),
							"30d": tCharts("period.30d"),
						}}
					/>
				}
			>
				<Suspense
					key={`outcomes-${period}`}
					fallback={
						<OutcomesCardSkeleton
							words={words.outcomes}
							className={CARD_SPAN.outcomes}
						/>
					}
				>
					<OutcomesCard
						period={period}
						logPath={routes.deliveries}
						className={CARD_SPAN.outcomes}
					/>
				</Suspense>
				<Suspense
					key={`timeline-${period}`}
					fallback={
						<TimelineCardSkeleton
							words={words.timeline}
							note={words.timelineNote}
							legend={words.legend}
							viewData={words.viewData}
							className={CARD_SPAN.timeline}
						/>
					}
				>
					<TimelineCard
						period={period}
						logPath={routes.deliveries}
						className={CARD_SPAN.timeline}
					/>
				</Suspense>
			</DeliveriesSection>
			<NowSection heading={tCharts("now.heading")}>
				<Suspense
					key={`queue-${period}`}
					fallback={
						<QueueCardSkeleton
							words={words.queue}
							viewData={words.viewData}
						/>
					}
				>
					<QueueCard queuePath={routes.queue} />
				</Suspense>
				<Suspense
					key={`suppression-${period}`}
					fallback={
						<SuppressionCardSkeleton
							words={words.suppression}
							viewData={words.viewData}
						/>
					}
				>
					<SuppressionCard suppressionPath={routes.suppression} />
				</Suspense>
			</NowSection>
		</>
	);
}
