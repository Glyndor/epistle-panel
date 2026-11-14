import type { OverviewPeriod } from "@/features/overview/schemas/overview-input";
import { DELIVERY_OUTCOMES, type DeliveryOutcome } from "@/lib/api/schemas";

const HOUR = 3600;
const DAY = 86_400;

/** How far back each period reaches and the width of its columns, in seconds. */
const PERIODS: Record<
	OverviewPeriod,
	{ span: number; step: number; unit: "hour" | "day" }
> = {
	"24h": { span: DAY, step: HOUR, unit: "hour" },
	"7d": { span: 7 * DAY, step: DAY, unit: "day" },
	"30d": { span: 30 * DAY, step: DAY, unit: "day" },
};

/**
 * Whether the records of a column are all there. The API returns at most 100
 * records and has no next page, so a full answer leaves part of the period
 * unread: `partial` is the column the answer stopped in, `missing` one it never
 * reached. Neither is a column with no delivery.
 */
export type BucketState = "complete" | "partial" | "missing";

/** The records of one hour or one day, in UTC. */
export interface DeliveryBucket {
	/** First second of the hour or the day, epoch seconds. */
	readonly start: number;
	/** One count per outcome, in the API's order. */
	readonly counts: readonly number[];
	readonly total: number;
	readonly state: BucketState;
}

/** The records of a period as columns over time. */
export interface DeliveryTimeline {
	readonly unit: "hour" | "day";
	/** Oldest first, every hour or day of the period, also the empty ones. */
	readonly buckets: readonly DeliveryBucket[];
	/** The largest total of a column. */
	readonly peak: number;
	readonly total: number;
}

const floorTo = (seconds: number, step: number) =>
	Math.floor(seconds / step) * step;

/**
 * Where a full answer stopped reading. The API reads the newest day first and,
 * inside a day, the oldest record first, and cuts at its limit: so every day
 * newer than the oldest one in the answer was read whole, and that oldest day
 * was read up to its last record in the answer.
 */
function readUpTo(times: readonly number[]): { day: number; time: number } {
	const day = floorTo(Math.min(...times), DAY);
	const time = Math.max(
		...times.filter((time) => floorTo(time, DAY) === day),
	);
	return { day, time };
}

function stateOf(
	start: number,
	step: number,
	stop: { day: number; time: number } | null,
): BucketState {
	if (stop === null || start >= stop.day + DAY) {
		return "complete";
	}
	if (start > stop.time || start + step <= stop.day) {
		return "missing";
	}
	return start + step <= stop.time ? "complete" : "partial";
}

/**
 * Put the delivery records of a period into columns: one per hour of the UTC
 * clock for 24 hours, one per UTC day for 7 and 30 days. The columns are
 * aligned to the clock, so the first and the last cover part of an hour or a
 * day, and together they cover the whole period: every record lands in one and
 * the totals add up to the number of records. A record a moment outside the
 * period (the server's clock read a little before the panel's) counts in the
 * nearest column.
 *
 * `full` says the answer came back at the API's limit. The columns it did not
 * read are then marked, see {@link BucketState}.
 */
export function bucketDeliveries(
	entries: readonly {
		readonly time: number;
		readonly outcome: DeliveryOutcome;
	}[],
	period: OverviewPeriod,
	nowSeconds: number,
	full: boolean,
): DeliveryTimeline {
	const { span, step, unit } = PERIODS[period];
	const first = floorTo(nowSeconds - span, step);
	const count = (floorTo(nowSeconds, step) - first) / step + 1;
	const counts = Array.from({ length: count }, () =>
		DELIVERY_OUTCOMES.map(() => 0),
	);
	for (const entry of entries) {
		const index = Math.min(
			Math.max(Math.floor((entry.time - first) / step), 0),
			count - 1,
		);
		const column = counts[index];
		const outcome = DELIVERY_OUTCOMES.indexOf(entry.outcome);
		if (column !== undefined && outcome >= 0) {
			column[outcome] = (column[outcome] ?? 0) + 1;
		}
	}
	const stop =
		full && entries.length > 0
			? readUpTo(entries.map((entry) => entry.time))
			: null;
	const buckets = counts.map((column, index) => {
		const start = first + index * step;
		return {
			start,
			counts: column,
			total: column.reduce((sum, value) => sum + value, 0),
			state: stateOf(start, step, stop),
		};
	});
	return {
		unit,
		buckets,
		peak: Math.max(0, ...buckets.map((bucket) => bucket.total)),
		total: entries.length,
	};
}
