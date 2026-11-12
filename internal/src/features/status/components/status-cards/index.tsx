"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusAction } from "@/features/status/actions/get-status";
import { statusQueryOptions } from "@/features/status/queries/status-query";
import { unwrap } from "@/lib/query/action-result";

const fetchStatus = async () => unwrap(await getStatusAction());

/** One counter: its label and its value. */
function StatusCard({ label, value }: { label: string; value: string }) {
	return (
		<Card className="gap-0.5 p-3">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd className="font-semibold text-xl tabular-nums">{value}</dd>
		</Card>
	);
}

/**
 * The status counters, as a compact row of cards. The first paint comes from
 * the server prefetch (hydrated into the query), and the numbers refresh every
 * 15 s while the tab is in view. Numbers go through `useFormatter`, so the
 * grouping follows the locale.
 */
export function StatusCards() {
	const t = useTranslations("dashboard");
	const format = useFormatter();
	const { data, isPending } = useQuery(statusQueryOptions(fetchStatus));

	if (isPending) {
		return (
			<div
				className="grid grid-cols-2 gap-2 sm:grid-cols-4"
				aria-busy="true"
			>
				{["version", "domains", "accounts", "queue"].map((key) => (
					<Skeleton key={key} className="h-16" />
				))}
			</div>
		);
	}
	if (data === undefined) {
		return (
			<Alert variant="warning">
				<AlertDescription>{t("unreachable")}</AlertDescription>
			</Alert>
		);
	}
	return (
		<dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
			<StatusCard label={t("version")} value={data.version} />
			<StatusCard
				label={t("domains")}
				value={format.number(data.domains)}
			/>
			<StatusCard
				label={t("accounts")}
				value={format.number(data.accounts)}
			/>
			<StatusCard
				label={t("queue")}
				value={format.number(data.queueSize)}
			/>
		</dl>
	);
}
