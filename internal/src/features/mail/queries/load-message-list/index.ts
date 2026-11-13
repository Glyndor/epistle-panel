import "server-only";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import {
	type EmailRecord,
	emailGetSchema,
	emailQuerySchema,
} from "@/features/mail/jmap/responses";
import { toSummary } from "@/features/mail/queries/to-views";
import {
	GET_CHUNK,
	type ListFilter,
	type MessageListInput,
	PAGE_SIZE,
	SCAN_LIMIT,
} from "@/features/mail/schemas/mail-input";
import type { MessageListView } from "@/features/mail/schemas/mail-view";

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
];

function chunksOf<T>(items: readonly T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let start = 0; start < items.length; start += size) {
		chunks.push(items.slice(start, start + size));
	}
	return chunks;
}

function matchesFilter(email: EmailRecord, filter: ListFilter): boolean {
	const keywords = email.keywords ?? {};
	switch (filter) {
		case "unread":
			return keywords["$seen"] !== true;
		case "flagged":
			return keywords["$flagged"] === true;
		case "attachments":
			return email.hasAttachment === true;
		case "all":
			return true;
	}
}

function matchesText(email: EmailRecord, needle: string): boolean {
	if (needle === "") {
		return true;
	}
	const haystack = [
		email.subject,
		email.preview,
		...[...(email.from ?? []), ...(email.to ?? [])].flatMap((a) => [
			a.name,
			a.email,
		]),
	]
		.filter((part): part is string => typeof part === "string")
		.join("\n")
		.toLowerCase();
	return haystack.includes(needle.toLowerCase());
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
 * One page of a folder. With no filter and no search the page is the slice of
 * the folder's ids and only those messages are fetched. Otherwise the newest
 * {@link SCAN_LIMIT} messages are fetched and filtered here, and `partial` says
 * so when the folder holds more.
 */
export async function loadMessageList(
	session: MailSession,
	input: MessageListInput,
): Promise<MessageListView> {
	const queried = await jmapCall(session, [
		[
			"Email/query",
			{ accountId: session.accountId, filter: { inMailbox: input.box } },
			"q",
		],
	]);
	const { ids } = methodResult(queried, "q", "Email/query", emailQuerySchema);
	const start = (input.page - 1) * PAGE_SIZE;

	if (input.filter === "all" && input.q === "") {
		const emails = await fetchEmails(
			session,
			ids.slice(start, start + PAGE_SIZE),
		);
		return {
			items: emails.map(toSummary),
			page: input.page,
			total: ids.length,
			hasNext: start + PAGE_SIZE < ids.length,
			partial: false,
		};
	}

	const scanned = await fetchEmails(session, ids.slice(0, SCAN_LIMIT));
	const matching = scanned.filter(
		(email) =>
			matchesFilter(email, input.filter) && matchesText(email, input.q),
	);
	return {
		items: matching.slice(start, start + PAGE_SIZE).map(toSummary),
		page: input.page,
		total: matching.length,
		hasNext: start + PAGE_SIZE < matching.length,
		partial: ids.length > SCAN_LIMIT,
	};
}
