import "server-only";

import { pageSizeOf } from "@/features/mail/config/page-size";
import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import {
	type EmailRecord,
	emailGetSchema,
	emailQuerySchema,
} from "@/features/mail/jmap/responses";
import {
	compareBy,
	matchesConditions,
} from "@/features/mail/queries/match-conditions";
import { readEffectivePageSize } from "@/features/mail/queries/page-size";
import { toSummary } from "@/features/mail/queries/to-views";
import {
	hasConditions,
	isDefaultOrder,
} from "@/features/mail/schemas/list-conditions-model";
import {
	GET_CHUNK,
	type MessageListInput,
	SCAN_LIMIT,
} from "@/features/mail/schemas/mail-input";
import type { MessageListView } from "@/features/mail/schemas/mail-view";
import { dayInZone } from "@/features/time-zone/format/day";
import { readEffectiveTimeZone } from "@/features/time-zone/queries/time-zone";

/** The properties a list row needs; the server may send more. */
const ROW_PROPERTIES = [
	"id",
	"receivedAt",
	"subject",
	"from",
	"to",
	"keywords",
	"preview",
	"hasAttachment",
	"size",
];

function chunksOf<T>(items: readonly T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let start = 0; start < items.length; start += size) {
		chunks.push(items.slice(start, start + size));
	}
	return chunks;
}

/** Fetch the emails named by `ids`, in that order, in as many calls as the server's limit needs. */
async function fetchEmails(
	session: MailSession,
	ids: readonly string[],
): Promise<EmailRecord[]> {
	if (ids.length === 0) {
		return [];
	}
	const chunks = chunksOf(ids, GET_CHUNK);
	const responses = await jmapCall(
		session,
		chunks.map(
			(chunk, index) =>
				[
					"Email/get",
					{
						accountId: session.accountId,
						ids: chunk,
						properties: ROW_PROPERTIES,
						bodyProperties: ["partId"],
					},
					`g${index}`,
				] as const,
		),
	);
	return chunks.flatMap(
		(_, index) =>
			methodResult(responses, `g${index}`, "Email/get", emailGetSchema)
				.list,
	);
}

/**
 * One page of a folder. With nothing narrowing the list and the default order
 * the page is the slice of the folder's ids and only those messages are
 * fetched. Otherwise the newest {@link SCAN_LIMIT} messages are fetched,
 * narrowed here, ordered as the conditions say, and `partial` says so when the
 * folder holds more. A page holds the number of messages the person chose, or
 * the operator fixed (`readEffectivePageSize`), 50 by default. `now` is when the list is read, which dates the groups
 * the rows are shown under.
 */
export async function loadMessageList(
	session: MailSession,
	input: MessageListInput,
	now: Date = new Date(),
): Promise<MessageListView> {
	// The day the list is read on, in the zone of the person: it is what
	// "today" means for the groups the rows stand under.
	const today = dayInZone(now, await readEffectiveTimeZone());
	const pageSize = pageSizeOf(await readEffectivePageSize());
	const { conditions } = input;
	// The folder of the page, unless the conditions name another one.
	const box = conditions.folder ?? input.box;
	const queried = await jmapCall(session, [
		[
			"Email/query",
			{ accountId: session.accountId, filter: { inMailbox: box } },
			"q",
		],
	]);
	const { ids } = methodResult(queried, "q", "Email/query", emailQuerySchema);
	const start = (input.page - 1) * pageSize;

	if (!hasConditions(conditions) && isDefaultOrder(conditions.order)) {
		const emails = await fetchEmails(
			session,
			ids.slice(start, start + pageSize),
		);
		return {
			items: emails.map(toSummary),
			page: input.page,
			total: ids.length,
			hasNext: start + pageSize < ids.length,
			partial: false,
			today,
		};
	}

	const scanned = await fetchEmails(session, ids.slice(0, SCAN_LIMIT));
	const matching = scanned
		.filter((email) => matchesConditions(email, conditions))
		.sort(compareBy(conditions.order));
	return {
		items: matching.slice(start, start + pageSize).map(toSummary),
		page: input.page,
		total: matching.length,
		hasNext: start + pageSize < matching.length,
		partial: ids.length > SCAN_LIMIT,
		today,
	};
}
