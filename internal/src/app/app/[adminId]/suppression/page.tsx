import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { AdminBreadcrumbs } from "@/features/navigation/components/admin-breadcrumbs";
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
	const { routes } = await requireAdmin();
	const t = await getTranslations("suppression");
	const after = parseAddressParam((await searchParams).after);

	return (
		<>
			<AdminBreadcrumbs routes={routes} page="suppression" />
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("description")}</p>
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
