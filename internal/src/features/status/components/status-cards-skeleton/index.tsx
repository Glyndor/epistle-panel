import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** The four counters the status page shows, in the order it shows them. */
const COUNTERS = ["version", "domains", "accounts", "queue"] as const;

/**
 * The waiting state of the status counters: the same container, grid and
 * cards, with a bar at the height of the label and one at the height of the
 * value, so the numbers replace it in place. The route's `loading.tsx`, the
 * page's `Suspense` fallback and the counters' own pending state all draw this.
 */
export function StatusCardsSkeleton() {
	const t = useTranslations("table");
	return (
		<div className="@container">
			<p className="sr-only" role="status">
				{t("loading")}
			</p>
			<div
				aria-busy="true"
				data-testid="status-skeleton"
				className="grid grid-cols-2 gap-3 @xl:grid-cols-4"
			>
				{COUNTERS.map((key) => (
					<Card key={key} aria-hidden="true" className="gap-0.5 p-3">
						<Skeleton className="h-4 w-16 rounded-md" />
						<Skeleton className="h-7 w-12 rounded-md" />
					</Card>
				))}
			</div>
		</div>
	);
}
