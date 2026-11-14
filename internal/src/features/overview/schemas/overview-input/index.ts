import type { Route } from "next";
import { z } from "zod";

import type { SINCE_VALUES } from "@/features/deliveries/schemas/deliveries-input";

/**
 * The periods the overview's delivery charts can cover. Each is also a `since`
 * of the delivery log, so a chart links to the log with the same value.
 */
export const OVERVIEW_PERIODS = [
	"24h",
	"7d",
	"30d",
] as const satisfies readonly (typeof SINCE_VALUES)[number][];
export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number];

/** The period shown when the address names none, or one that is not offered. */
export const DEFAULT_PERIOD: OverviewPeriod = "24h";

const periodSchema = z.enum(OVERVIEW_PERIODS);

/**
 * Read the `since` query parameter of the overview. Next hands a repeated
 * parameter over as an array: the first value counts. Anything that is not one
 * of the periods on offer is the default, so no text from the address reaches
 * the API or the page.
 */
export function parsePeriodParam(
	value: string | string[] | undefined,
): OverviewPeriod {
	const parsed = periodSchema.safeParse(
		Array.isArray(value) ? value[0] : value,
	);
	return parsed.success ? parsed.data : DEFAULT_PERIOD;
}

/**
 * The address of the overview for a period. The default period is the bare
 * path, so there is one address for it and not two.
 */
export function overviewHref(home: Route, period: OverviewPeriod): Route {
	return period === DEFAULT_PERIOD
		? home
		: (`${home}?since=${period}` as Route);
}
