import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { StatusCards } from "@/features/status/components/status-cards";
import { StatusCardsSkeleton } from "@/features/status/components/status-cards-skeleton";
import { loadStatus } from "@/features/status/queries/load-status";
import { statusQueryOptions } from "@/features/status/queries/status-query";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetchSpec } from "@/lib/query/prefetch";

/**
 * The status page. The role is checked before anything is sent; the heading
 * paints at once and the counters stream in when the API answers, then refresh
 * in the browser.
 */
export default async function HomePage() {
	await requireAdmin();
	const t = await getTranslations("dashboard");

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<Suspense fallback={<StatusCardsSkeleton />}>
				<PrefetchBoundary
					queries={[
						prefetchSpec(
							statusQueryOptions(loadStatus),
							"status fetch",
						),
					]}
				>
					<StatusCards />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
