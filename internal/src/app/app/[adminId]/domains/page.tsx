import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { DomainsTable } from "@/features/domains/components/domains-table";
import { domainsQueryOptions } from "@/features/domains/queries/domains-query";
import { loadDomains } from "@/features/domains/queries/load-domains";
import { requireAdmin } from "@/lib/auth/require-session";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/** The domains page: the list prefetched on the server, then owned by Query. */
export default async function DomainsPage() {
	await requireAdmin();
	const t = await getTranslations("domains");
	const client = getServerQueryClient();
	await prefetch(client, domainsQueryOptions(loadDomains), "domains fetch");

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<HydrationBoundary state={dehydrate(client)}>
				<DomainsTable />
			</HydrationBoundary>
		</>
	);
}
