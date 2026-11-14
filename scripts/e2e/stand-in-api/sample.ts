/**
 * Data sets the stand-in can be switched to through `POST /__control/sample`,
 * for the checks of the overview's charts. The seeds the stand-in starts with
 * are a handful of records, enough for a table and too few for a chart; these
 * have a spread of outcomes over a month, a queue of several ages and a
 * suppression list of several domains. `POST /__control/reset` puts the seeds
 * back. `quiet` holds nothing, `log-off` has the delivery log switched off and
 * `edge` holds the cases a layout breaks on.
 *
 * Three more hold the cases a chart can lie on. `exact100` has exactly as many
 * records as one answer holds, and a queue and a list of exactly what the
 * overview reads: nothing is missing, and the API cannot say so. `flood` has
 * more of each than is read. `skew` has hours of very different totals, one
 * with a record of every outcome, to compare the heights of the columns.
 */

/** One delivery record of a sample, by its age when the stand-in started. */
export interface SampleDelivery {
	ageSeconds: number;
	outcome: string;
}

/** One queued message of a sample. */
export interface SampleQueued {
	id: string;
	reverse_path: string;
	recipients: string[];
}

/** A named data set. */
export interface Sample {
	/** `null` turns the delivery log off: the endpoint answers 404, as with a retention of 0 days. */
	deliveries: SampleDelivery[] | null;
	queue: SampleQueued[];
	suppressed: string[];
}

const HOUR = 3600;
const DAY = 86_400;

/** `count` ages spread evenly from `from` to just under `to`, newest first. */
function spread(count: number, from: number, to: number): number[] {
	return Array.from({ length: count }, (_, index) =>
		Math.floor(from + ((to - from) * index) / count),
	);
}

/** Give each age an outcome so the totals are exactly `counts`, mixed and not in blocks. */
function withOutcomes(
	ages: number[],
	counts: Record<string, number>,
): SampleDelivery[] {
	const left = { ...counts };
	const names = Object.keys(counts);
	return ages.map((ageSeconds, index) => {
		for (let step = 0; step < names.length; step += 1) {
			const name = names[(index + step) % names.length] ?? "delivered";
			if ((left[name] ?? 0) > 0) {
				left[name] = (left[name] ?? 0) - 1;
				return { ageSeconds, outcome: name };
			}
		}
		return { ageSeconds, outcome: "delivered" };
	});
}

/**
 * What the busy sample's log holds, by how far back a reader looks: 67 records
 * in 24 hours, 87 in 7 days and 127 in 30 days, which is more than the API
 * returns in one answer.
 */
export const BUSY_COUNTS = {
	"24h": { delivered: 48, deferred: 9, failed: 6, suppressed: 3, canceled: 1 },
	"7d": { delivered: 62, deferred: 11, failed: 9, suppressed: 4, canceled: 1 },
} as const;

/** Records one answer of the delivery log holds: the `exact100` sample has exactly these. */
const EXACT = 100;

/** Messages and addresses the overview reads at most, five pages of 100: `exact100` has exactly these. */
const READ = 500;

/** What the flood sample's log holds in 24 hours: three answers' worth. */
export const FLOOD_COUNTS = {
	delivered: 200,
	deferred: 40,
	failed: 30,
	suppressed: 20,
	canceled: 10,
} as const;

/** The flood sample's queue and suppression list: more than the overview reads. */
export const FLOOD_QUEUE = 620;
export const FLOOD_SUPPRESSED = 640;

/**
 * The skew sample's log: how many hours of the UTC clock before the current
 * one, how many records, of which outcome. The hours hold 60, 5 (one of each
 * outcome), 12, 2 and 8 records, so five small parts stand beside a single
 * part of more.
 */
export const SKEW_HOURS: ReadonlyArray<
	[hoursAgo: number, count: number, outcome: string]
> = [
	[3, 60, "delivered"],
	[6, 1, "delivered"],
	[6, 1, "deferred"],
	[6, 1, "failed"],
	[6, 1, "suppressed"],
	[6, 1, "canceled"],
	[9, 12, "delivered"],
	[12, 1, "delivered"],
	[12, 1, "failed"],
	[15, 8, "delivered"],
];

/** The busy sample's queue, by waiting time: ten messages for seventeen recipients. */
const BUSY_QUEUE_AGES: ReadonlyArray<[age: number, recipients: number]> = [
	[5 * 60, 1],
	[20 * 60, 2],
	[50 * 60, 1],
	[2 * HOUR, 3],
	[4 * HOUR, 1],
	[5 * HOUR, 1],
	[9 * HOUR, 2],
	[20 * HOUR, 1],
	[30 * HOUR, 1],
	[3 * DAY, 4],
];

/**
 * A UUID of version 7 made `ageSeconds` before `nowMs`: its first 48 bits are
 * the millisecond it was made, which is how the real API's queue ids carry the
 * time a message was accepted. `serial` keeps two ids of the same age apart.
 */
export function uuidV7(nowMs: number, ageSeconds: number, serial: number): string {
	const stamp = (nowMs - ageSeconds * 1000).toString(16).padStart(12, "0");
	return `${stamp.slice(0, 8)}-${stamp.slice(8)}-7000-8000-${String(serial).padStart(12, "0")}`;
}

/**
 * Build the sample of that name as of `nowMs`, or `undefined` for a name that
 * is not one. `started` is the second the ages of the delivery records count
 * back from, which the `skew` sample needs to put its records inside hours of
 * the clock.
 */
export function buildSample(
	name: string,
	nowMs: number,
	started = Math.floor(nowMs / 1000),
): Sample | undefined {
	if (name === "quiet") {
		return { deliveries: [], queue: [], suppressed: [] };
	}
	if (name === "log-off") {
		return { deliveries: null, queue: [], suppressed: [] };
	}
	if (name === "edge") {
		// The cases a layout breaks on: one record, one message, an id with no
		// time in it, a domain far longer than a card and one that looks like
		// markup.
		const long = `${"subdomain.".repeat(18)}example.org`;
		return {
			deliveries: [{ ageSeconds: 10 * 60, outcome: "delivered" }],
			queue: [
				{
					id: uuidV7(nowMs, 2 * HOUR, 1),
					reverse_path: "",
					recipients: ["one@example.net"],
				},
				{
					id: "11111111-1111-4111-8111-111111111111",
					reverse_path: "old@example.test",
					recipients: [],
				},
			],
			suppressed: [
				`a@${long}`,
				`b@${long}`,
				`c@${long}`,
				"d@<b>bold</b>.test",
				"e@ñandú.example",
			],
		};
	}
	if (name === "exact100" || name === "flood") {
		const full = name === "exact100";
		return {
			deliveries: full
				? spread(EXACT, 5 * 60, 20 * HOUR).map((ageSeconds) => ({
						ageSeconds,
						outcome: "delivered",
					}))
				: withOutcomes(spread(300, 5 * 60, DAY - 10 * 60), FLOOD_COUNTS),
			queue: Array.from({ length: full ? READ : FLOOD_QUEUE }, (_, index) => ({
				id: uuidV7(nowMs, 3 * DAY - index * 60, index + 1),
				reverse_path: `s${index}@example.test`,
				recipients: [`r${index}@example.net`],
			})),
			suppressed: Array.from(
				{ length: full ? READ : FLOOD_SUPPRESSED },
				(_, index) => `u${String(index).padStart(4, "0")}@d${index % 9}.example`,
			),
		};
	}
	if (name === "skew") {
		// Ten minutes into an hour of the UTC clock, so a group is never cut
		// in two by the turn of an hour whenever the check runs.
		const intoHour = started % HOUR;
		return {
			deliveries: SKEW_HOURS.flatMap(([hoursAgo, count, outcome]) =>
				Array.from({ length: count }, (_, index) => ({
					ageSeconds: hoursAgo * HOUR + intoHour - 600 - index,
					outcome,
				})),
			),
			queue: [],
			suppressed: [],
		};
	}
	if (name !== "busy") {
		return undefined;
	}
	const day = withOutcomes(spread(67, 5 * 60, DAY - 10 * 60), BUSY_COUNTS["24h"]);
	const week = withOutcomes(spread(20, DAY + HOUR, 7 * DAY - HOUR), {
		delivered: 14,
		deferred: 2,
		failed: 3,
		suppressed: 1,
	});
	const month = withOutcomes(spread(40, 7 * DAY + HOUR, 30 * DAY - HOUR), {
		delivered: 34,
		deferred: 2,
		failed: 4,
	});
	return {
		deliveries: [...day, ...week, ...month],
		// Oldest first, as the API lists the queue.
		queue: [...BUSY_QUEUE_AGES]
			.sort(([a], [b]) => b - a)
			.map(([age, recipients], index) => ({
				id: uuidV7(nowMs, age, index + 1),
				reverse_path: `sender${index}@example.test`,
				recipients: Array.from(
					{ length: recipients },
					(_, n) => `rcpt${index}-${n}@example.net`,
				),
			})),
		suppressed: [
			"a1@example.net",
			"a2@example.net",
			"a3@example.net",
			"a4@example.net",
			"a5@example.net",
			"b1@example.org",
			"b2@example.org",
			"b3@example.org",
			"c1@mail.test",
			"c2@mail.test",
			"d1@alpha.test",
			"e1@beta.test",
			"f1@gamma.test",
			"g1@omega.test",
		],
	};
}

/**
 * Put delivery records in the order the real API lists them: the newest UTC
 * day first and, inside a day, the oldest record first. A sample that holds
 * more than a page is then cut where the real API would cut it.
 */
export function inApiOrder<T extends { time: number }>(records: T[]): T[] {
	const dayOf = (record: T) => Math.floor(record.time / DAY);
	return [...records].sort(
		(a, b) => dayOf(b) - dayOf(a) || a.time - b.time,
	);
}
