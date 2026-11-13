import { DELIVERY_OUTCOMES, type DeliveryOutcome } from "@/lib/api/schemas";
import { sharesPerMille } from "@/lib/charts/shares";

/** How many records ended one way, and their share of all of them in tenths of a percent. */
export interface OutcomeCount {
	readonly outcome: DeliveryOutcome;
	readonly count: number;
	readonly share: number;
}

/** The records of a period counted by outcome. */
export interface OutcomeCounts {
	readonly total: number;
	/** One entry per outcome, in the API's order, also for an outcome nothing had. */
	readonly parts: readonly OutcomeCount[];
}

/**
 * Count delivery records by outcome. The parts come in the order the API
 * names the outcomes, which is the order a chart stacks and colours them in,
 * and their shares add up to exactly 1000 when there is at least one record.
 */
export function countOutcomes(
	entries: readonly { readonly outcome: DeliveryOutcome }[],
): OutcomeCounts {
	const counts = DELIVERY_OUTCOMES.map(
		(outcome) =>
			entries.filter((entry) => entry.outcome === outcome).length,
	);
	const shares = sharesPerMille(counts);
	return {
		total: entries.length,
		parts: DELIVERY_OUTCOMES.map((outcome, index) => ({
			outcome,
			count: counts[index] ?? 0,
			share: shares[index] ?? 0,
		})),
	};
}
