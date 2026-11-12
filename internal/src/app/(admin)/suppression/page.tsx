import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { SuppressionTable } from "@/features/suppression/components/suppression-table";
import { loadSuppression } from "@/features/suppression/queries/load-suppression";
import { suppressionQueryOptions } from "@/features/suppression/queries/suppression-query";
import { requireSession } from "@/lib/auth/require-session";
import { parseAddressParam } from "@/lib/mail-address";
import { prefetch } from "@/lib/query/prefetch";
import { getServerQueryClient } from "@/lib/query/server-query-client";

/** The suppression list page: one page prefetched on the server, then owned by Query. */
export default async function SuppressionPage({
	searchParams,
}: {
	searchParams: Promise<{ after?: string | string[] }>;
}) {
	await requireSession();
	const t = await getTranslations("suppression");
	const after = parseAddressParam((await searchParams).after);
	const client = getServerQueryClient();
	await prefetch(
		client,
		suppressionQueryOptions(after, loadSuppression),
		"suppression fetch",
	);

	return (
		<>
			<h1 className="font-semibold text-lg">{t("heading")}</h1>
			<p className="text-muted-foreground">{t("description")}</p>
			<HydrationBoundary state={dehydrate(client)}>
				<SuppressionTable after={after} />
			</HydrationBoundary>
		</>
	);
}
