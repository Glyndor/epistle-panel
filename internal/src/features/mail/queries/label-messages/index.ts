import "server-only";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import { emailGetSchema, emailSetSchema } from "@/features/mail/jmap/responses";
import { labelKey } from "@/features/mail/labels/keyword-codec";
import { encodeLabelName } from "@/features/mail/labels/name-codec";
import type { LabelMessagesInput } from "@/features/mail/schemas/label-input";

/** What a label change did, message by message: the label's keyword and which messages the server changed and which it did not. */
export interface LabelOutcome {
	/** The keyword the label is carried by: the one given, or the one the new name is written as. */
	readonly keyword: string;
	/** The messages that now are as asked, including the ones that already were. */
	readonly updated: readonly string[];
	/** The messages the server did not change: refused, or no longer there. */
	readonly failed: readonly string[];
}

/**
 * Put a label on messages or take it off. epistle's `Email/set` `update`
 * replaces `keywords` whole, so each message's set is read first and written
 * back with only this label changed: all the messages in one read and one write.
 * The label is found without regard to case, as the server compares keywords,
 * and is taken off in every spelling it is held in. A message that already is
 * as asked is not written. Never touches a keyword that is not the label.
 *
 * A name is written as its keyword here (`encodeLabelName`), from the same
 * rule the field and the schema use; the client's own guess of that keyword is
 * never believed.
 */
export async function labelMessages(
	session: MailSession,
	input: LabelMessagesInput,
): Promise<LabelOutcome> {
	const keyword =
		input.kind === "create" ? encodeLabelName(input.name) : input.keyword;
	if (keyword === null) {
		throw new Error("not a label name");
	}
	const on = input.kind === "create" ? true : input.on;
	const wanted = labelKey(keyword);

	const read = await jmapCall(session, [
		[
			"Email/get",
			{
				accountId: session.accountId,
				ids: input.ids,
				properties: ["id", "keywords"],
				bodyProperties: ["partId"],
			},
			"g",
		],
	]);
	const found = new Map(
		methodResult(read, "g", "Email/get", emailGetSchema).list.map(
			(email) => [email.id, email] as const,
		),
	);

	const update: Record<string, { keywords: Record<string, boolean> }> = {};
	const updated: string[] = [];
	const failed: string[] = [];
	for (const id of input.ids) {
		const email = found.get(id);
		if (email === undefined) {
			failed.push(id);
			continue;
		}
		const held = Object.entries(email.keywords ?? {})
			.filter(([, set]) => set)
			.map(([name]) => name);
		const holds = held.some((name) => labelKey(name) === wanted);
		if (holds === on) {
			updated.push(id);
			continue;
		}
		const next = held.filter((name) => labelKey(name) !== wanted);
		if (on) {
			next.push(keyword);
		}
		update[id] = {
			keywords: Object.fromEntries(next.map((name) => [name, true])),
		};
	}

	if (Object.keys(update).length > 0) {
		const written = await jmapCall(session, [
			["Email/set", { accountId: session.accountId, update }, "s"],
		]);
		const result = methodResult(written, "s", "Email/set", emailSetSchema);
		for (const id of Object.keys(update)) {
			(result.updated !== null &&
			result.updated !== undefined &&
			id in result.updated
				? updated
				: failed
			).push(id);
		}
	}
	return { keyword, updated, failed };
}
