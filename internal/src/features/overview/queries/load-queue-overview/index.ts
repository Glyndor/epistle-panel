import "server-only";

import { cache } from "react";

import { queueAges } from "@/features/overview/queries/queue-ages";
import type { QueueOverview } from "@/features/overview/schemas/overview-view";
import { getQueue } from "@/lib/api/client";
import { logApiFailure } from "@/lib/api/log-failure";

/** Messages asked for in one call: the most the API gives. */
const PAGE_SIZE = 100;

/** Most calls one overview makes for the queue, so a long queue cannot hold the page. */
const MAX_PAGES = 5;

/**
 * Read the outbound queue for the overview, oldest message first, following
 * the API's cursor for at most {@link MAX_PAGES} pages of {@link PAGE_SIZE}.
 * A queue longer than that is `capped`: what was not read is newer than what
 * was. A failure is logged under a fixed name and answered as `unreachable`.
 */
export async function loadQueueOverview(): Promise<QueueOverview> {
	try {
		const entries: { id: string; recipients: string[] }[] = [];
		let cursor: string | undefined;
		for (let page = 0; page < MAX_PAGES; page += 1) {
			const answer = await getQueue(
				cursor === undefined
					? { limit: PAGE_SIZE }
					: { limit: PAGE_SIZE, cursor },
			);
			entries.push(...answer.entries);
			cursor = answer.next_cursor;
			if (cursor === undefined) {
				break;
			}
		}
		return {
			kind: "data",
			ages: queueAges(entries, Math.floor(Date.now() / 1000)),
			capped: cursor !== undefined,
		};
	} catch (error) {
		logApiFailure("overview queue", error);
		return { kind: "unreachable" };
	}
}

/**
 * The queue overview of the request: the card that draws it and the notice of
 * the page ask for it, and the API is asked once.
 */
export const requestQueueOverview: () => Promise<QueueOverview> =
	cache(loadQueueOverview);
