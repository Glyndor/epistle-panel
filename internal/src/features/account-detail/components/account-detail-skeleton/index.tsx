import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Sections the account page draws before its data is known. */
const SECTIONS = ["addresses", "profile", "security"] as const;

/**
 * The waiting state of the account page: the breadcrumb line and the first
 * section cards, at the width and gaps of the real ones. The route's
 * `loading.tsx`, the page's `Suspense` fallback and the account view's own
 * pending state all draw this.
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
				<Skeleton className="h-5 w-48 rounded-md" />
				{SECTIONS.map((section) => (
					<Card key={section} aria-hidden="true">
						<div className="flex flex-col gap-3">
							<Skeleton className="h-6 w-40 rounded-md" />
							<Skeleton className="h-16 rounded-lg" />
						</div>
					</Card>
				))}
			</div>
		</div>
	);
}
