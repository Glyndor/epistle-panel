import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { PrefetchBoundary } from "@/components/prefetch-boundary";
import { DomainsTable } from "@/features/domains/components/domains-table";
import { DomainsTableSkeleton } from "@/features/domains/components/domains-table-skeleton";
import { domainsQueryOptions } from "@/features/domains/queries/domains-query";
import { loadDomains } from "@/features/domains/queries/load-domains";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetchSpec } from "@/lib/query/prefetch";

/** The domains page: the heading at once, the list streamed in, then owned by Query. */
export default async function DomainsPage() {
	await requireAdmin();
	const t = await getTranslations("domains");

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<Suspense fallback={<DomainsTableSkeleton />}>
				<PrefetchBoundary
					queries={[
						prefetchSpec(
							domainsQueryOptions(loadDomains),
							"domains fetch",
						),
					]}
				>
					<DomainsTable />
				</PrefetchBoundary>
			</Suspense>
		</>
	);
}
