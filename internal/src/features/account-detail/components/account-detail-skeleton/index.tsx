import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The waiting state of the account page: the card of the section on screen, at
 * the width and gaps of the real one. The route's `loading.tsx`, the page's
 * `Suspense` fallback and the section's own loading state all draw this.
 */
export function AccountDetailSkeleton() {
	const t = useTranslations("table");
	return (
		<div className="flex max-w-3xl flex-col gap-4">
			<p className="sr-only" role="status">
				{t("loading")}
			</p>
			<div
				aria-busy="true"
				data-testid="account-skeleton"
				className="flex flex-col gap-4"
			>
				<Card aria-hidden="true">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-6 w-40 rounded-md" />
						<Skeleton className="h-16 rounded-lg" />
					</div>
				</Card>
			</div>
		</div>
	);
}
