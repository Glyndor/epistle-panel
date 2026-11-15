import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { SuppressionHeading } from "@/features/suppression/components/suppression-heading";
import { SuppressionTable } from "@/features/suppression/components/suppression-table";
import { SuppressionTableSkeleton } from "@/features/suppression/components/suppression-table-skeleton";
import { loadSuppression } from "@/features/suppression/queries/load-suppression";
import { suppressionQueryOptions } from "@/features/suppression/queries/suppression-query";
import { requireAdmin } from "@/lib/auth/require-session";
import { parseAddressParam } from "@/lib/mail-address";
import { prefetchSpec } from "@/lib/query/prefetch";

/**
 * The suppression list page: heading and description at once, one page of the
 * list streamed in, then owned by Query. The cursor is parsed before anything
 * is sent.
 */
export default async function SuppressionPage({
	searchParams,
}: {
	searchParams: Promise<{ after?: string | string[] }>;
}) {
	await requireAdmin();
	const after = parseAddressParam((await searchParams).after);

	return (
		<>
			<SuppressionHeading />
			<Suspense key={after ?? ""} fallback={<SuppressionTableSkeleton />}>
				<PrefetchBoundary
					queries={[
						prefetchSpec(
							suppressionQueryOptions(after, loadSuppression),
							"suppression fetch",
						),
					]}
				>
					<SuppressionTable after={after} />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
