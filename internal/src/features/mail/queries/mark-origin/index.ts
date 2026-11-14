import "server-only";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import { emailGetSchema, emailSetSchema } from "@/features/mail/jmap/responses";
import { hasKeyword } from "@/features/mail/labels/read-keywords";
import type {
	ComposeInput,
	OriginMark,
} from "@/features/mail/schemas/compose-input";
import { logApiFailure } from "@/lib/api/log-failure";

/** The keyword each mark is. */
const MARK_KEYWORD = {
	answered: "$answered",
	forwarded: "$forwarded",
} as const satisfies Record<OriginMark, string>;

/**
 * Mark the message a reply or a forward came from, once it is sent. epistle
 * replaces the keywords whole, so the message is read first and every keyword
 * it has is written back with the mark added; one that already carries it, in
 * any case, is left alone. The id comes from the browser: a message that is
 * not the account's is not found and nothing is written. The message is sent
 * by now, so a failure here is logged and is not the sender's problem.
 */
export async function markOrigin(
	session: MailSession,
	origin: ComposeInput["origin"],
): Promise<void> {
	if (origin === undefined) {
		return;
	}
	const keyword = MARK_KEYWORD[origin.as];
	try {
		const read = await jmapCall(session, [
			[
				"Email/get",
				{
					accountId: session.accountId,
					ids: [origin.id],
					properties: ["id", "keywords"],
					bodyProperties: ["partId"],
				},
				"o",
			],
		]);
		const email = methodResult(read, "o", "Email/get", emailGetSchema)
			.list[0];
		if (email === undefined || hasKeyword(email.keywords, keyword)) {
			return;
		}
		const keywords = Object.fromEntries(
			Object.entries(email.keywords ?? {})
				.filter(([, on]) => on)
				.map(([name]) => [name, true] as const),
		);
		const written = await jmapCall(session, [
			[
				"Email/set",
				{
					accountId: session.accountId,
					update: {
						[origin.id]: {
							keywords: { ...keywords, [keyword]: true },
						},
					},
				},
				"k",
			],
		]);
		methodResult(written, "k", "Email/set", emailSetSchema);
	} catch (error) {
		logApiFailure("mail mark origin", error);
	}
}
