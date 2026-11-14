"use client";

import { useQuery } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { getStatusAction } from "@/features/status/actions/get-status";
import { StatusCardsSkeleton } from "@/features/status/components/status-cards-skeleton";
import { statusQueryOptions } from "@/features/status/queries/status-query";
import { cn } from "@/lib/class-names";
import { unwrap } from "@/lib/query/action-result";

const fetchStatus = async () => unwrap(await getStatusAction());

/** The four counters, in the order the page shows them. */
const COUNTERS = ["version", "domains", "accounts", "queue"] as const;

/** One counter: its label and its value. `quiet` is a value that could not be read. */
function StatusCard({
	label,
	value,
	quiet = false,
}: {
	label: string;
	value: string;
	quiet?: boolean;
}) {
	return (
		<Card className="gap-0.5 p-3">
			<dt className="text-muted-foreground text-xs">{label}</dt>
			<dd
				className={cn(
					"font-semibold text-xl tabular-nums",
					quiet && "text-muted-foreground",
				)}
			>
				{value}
			</dd>
		</Card>
	);
}

/**
 * The status counters, as a compact row of cards that goes from two columns to four by the width of its own container, not of the window. The first paint comes from
 * the server prefetch (hydrated into the query), and the numbers refresh every
 * 15 s while the tab is in view. Numbers go through `useFormatter`, so the
 * grouping follows the locale.
 */
export function StatusCards() {
	const t = useTranslations("dashboard");
	const format = useFormatter();
	const { data, isPending } = useQuery(statusQueryOptions(fetchStatus));

	if (isPending) {
		return <StatusCardsSkeleton />;
	}
	if (data === undefined) {
		// Not a warning of its own: the page gives one for every part of it
		// that the API did not answer, with the link to try again. The four
		// cards stay, each with its label and a dash, so nothing under them
		// moves: one line of text in their place lifted the page by 132 px on
		// a phone. A screen reader is told once that they could not be read.
		return (
			<div className="@container" data-slot="status-unavailable">
				<p className="sr-only">{t("unavailable")}</p>
				<dl className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
					{COUNTERS.map((key) => (
						<StatusCard
							key={key}
							label={t(key)}
							value={t("none")}
							quiet
						/>
					))}
				</dl>
			</div>
		);
	}
	const values = {
		version: data.version,
		domains: format.number(data.domains),
		accounts: format.number(data.accounts),
		queue: format.number(data.queueSize),
	};
	return (
		<div className="@container">
			<dl className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
				{COUNTERS.map((key) => (
					<StatusCard key={key} label={t(key)} value={values[key]} />
				))}
			</dl>
		</div>
	);
}
