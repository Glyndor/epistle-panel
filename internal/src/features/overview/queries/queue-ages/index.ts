import { sharesPerMille } from "@/lib/charts/shares";

const HOUR = 3600;

/** How long a queued message has waited, shortest first; `unknown` for an id that carries no time. */
export const QUEUE_AGES = [
	"under1h",
	"under6h",
	"under24h",
	"over24h",
	"unknown",
] as const;
export type QueueAge = (typeof QUEUE_AGES)[number];

/** The messages of one waiting time, and their share of the ones read in tenths of a percent. */
export interface QueueAgeCount {
	readonly age: QueueAge;
	readonly count: number;
	readonly share: number;
}

/** The queue, counted by how long each message has waited. */
export interface QueueAges {
	readonly messages: number;
	/** Recipients still pending over all the messages; one message can have several. */
	readonly recipients: number;
	/** One entry per waiting time, in order; `unknown` is last and only there when it counts something. */
	readonly parts: readonly QueueAgeCount[];
}

const UUID_V7 =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The second a UUID version 7 was made, read from its first 48 bits, which are
 * the milliseconds since the epoch. The API's queue ids are of that version
 * and are made when a message is accepted, so the id says when it joined the
 * queue; the API gives no other date. Any other id, a version 4 one included,
 * carries no time: `null`.
 */
export function uuidV7Seconds(id: string): number | null {
	if (!UUID_V7.test(id)) {
		return null;
	}
	return Math.floor(
		Number.parseInt(id.slice(0, 8) + id.slice(9, 13), 16) / 1000,
	);
}

function ageOf(id: string, nowSeconds: number): QueueAge {
	const made = uuidV7Seconds(id);
	if (made === null) {
		return "unknown";
	}
	const waited = nowSeconds - made;
	if (waited < HOUR) {
		// Also an id from a clock a little ahead of the panel's.
		return "under1h";
	}
	if (waited < 6 * HOUR) {
		return "under6h";
	}
	return waited < 24 * HOUR ? "under24h" : "over24h";
}

/**
 * Count queued messages by how long they have waited: under an hour, 1 to 6
 * hours, 6 to 24 hours, a day or more. A message whose id carries no time is
 * counted apart as `unknown`, never guessed into a waiting time. The shares add
 * up to exactly 1000 when there is at least one message.
 */
export function queueAges(
	entries: readonly {
		readonly id: string;
		readonly recipients: readonly string[];
	}[],
	nowSeconds: number,
): QueueAges {
	const counts = new Map<QueueAge, number>(QUEUE_AGES.map((age) => [age, 0]));
	for (const entry of entries) {
		const age = ageOf(entry.id, nowSeconds);
		counts.set(age, (counts.get(age) ?? 0) + 1);
	}
	const ages = QUEUE_AGES.filter(
		(age) => age !== "unknown" || (counts.get(age) ?? 0) > 0,
	);
	const shares = sharesPerMille(ages.map((age) => counts.get(age) ?? 0));
	return {
		messages: entries.length,
		recipients: entries.reduce(
			(sum, entry) => sum + entry.recipients.length,
			0,
		),
		parts: ages.map((age, index) => ({
			age,
			count: counts.get(age) ?? 0,
			share: shares[index] ?? 0,
		})),
	};
}
