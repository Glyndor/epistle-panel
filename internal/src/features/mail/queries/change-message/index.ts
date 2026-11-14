import "server-only";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import {
	emailGetSchema,
	emailSetSchema,
	mailboxRolesSchema,
} from "@/features/mail/jmap/responses";
import type {
	ChangeMessageInput,
	MessageOp,
} from "@/features/mail/schemas/mail-input";

/** What a change did, for the interface to follow it. */
export interface ChangeOutcome {
	/** The message left its folder (moved or destroyed): its id is gone and the list must reload. */
	readonly left: boolean;
	/** The folder it went to, when it moved; `null` for a destroy or a keyword change. */
	readonly movedTo: string | null;
	readonly destroyed: boolean;
}

/** Raised when the account has no folder with the role an operation needs. */
export class NoFolderError extends Error {
	readonly role: string;
	constructor(role: string) {
		super(`no ${role} folder`);
		this.name = "NoFolderError";
		this.role = role;
	}
}

const ROLE_OF: Partial<Record<MessageOp, string>> = {
	archive: "archive",
	trash: "trash",
	spam: "junk",
	inbox: "inbox",
};

/**
 * Whether the set holds the keyword in any spelling. epistle returns a keyword
 * as it was set and matches it without regard to case, so `$Important` from an
 * IMAP client and `$important` are the one keyword.
 */
function holds(keywords: ReadonlySet<string>, name: string): boolean {
	const wanted = name.toLowerCase();
	return [...keywords].some((keyword) => keyword.toLowerCase() === wanted);
}

/** Take the keyword out in every spelling it is held in. */
function drop(keywords: Set<string>, name: string): void {
	const wanted = name.toLowerCase();
	for (const keyword of [...keywords]) {
		if (keyword.toLowerCase() === wanted) {
			keywords.delete(keyword);
		}
	}
}

/**
 * Change one message. epistle's `Email/set` `update` replaces `keywords` whole
 * and reads a `mailboxIds` update as "move to the first key set", so this reads
 * the message first, writes the full keyword set it wants, and names the one
 * target folder. A move makes a new message in the target and removes the old
 * one, so the id changes: the outcome says the message left. A message already
 * in the trash that is sent to the trash is destroyed.
 */
export async function changeMessage(
	session: MailSession,
	input: ChangeMessageInput,
): Promise<ChangeOutcome> {
	const role = input.op === "move" ? undefined : ROLE_OF[input.op];
	const read = await jmapCall(session, [
		[
			"Email/get",
			{
				accountId: session.accountId,
				ids: [input.id],
				properties: ["id", "keywords", "mailboxIds"],
				bodyProperties: ["partId"],
			},
			"g",
		],
		...(role === undefined
			? []
			: ([
					[
						"Mailbox/get",
						{
							accountId: session.accountId,
							ids: null,
							properties: ["id", "role"],
						},
						"m",
					],
				] as const)),
	]);
	const email = methodResult(read, "g", "Email/get", emailGetSchema).list[0];
	if (email === undefined) {
		throw new Error("message not found");
	}
	const current = Object.entries(email.mailboxIds ?? {}).find(
		([, on]) => on,
	)?.[0];
	const keywords = Object.entries(email.keywords ?? {})
		.filter(([, on]) => on)
		.map(([name]) => name);
	const next = new Set(keywords);

	let target: string | undefined;
	if (input.op === "move") {
		target = input.box;
	} else if (role !== undefined) {
		const found = methodResult(
			read,
			"m",
			"Mailbox/get",
			mailboxRolesSchema,
		).list.find((box) => box.role === role);
		if (found === undefined) {
			throw new NoFolderError(role);
		}
		target = found.id;
	}
	switch (input.op) {
		case "read":
			next.add("$seen");
			break;
		case "unread":
			next.delete("$seen");
			break;
		case "star":
			next.add("$flagged");
			break;
		case "unstar":
			next.delete("$flagged");
			break;
		case "important":
			if (!holds(next, "$important")) {
				next.add("$important");
			}
			break;
		case "unimportant":
			drop(next, "$important");
			break;
		default:
	}

	const destroy =
		input.op === "trash" && current !== undefined && current === target;
	const move = target !== undefined && !destroy && target !== current;
	const update = {
		keywords: Object.fromEntries([...next].map((name) => [name, true])),
		...(move ? { mailboxIds: { [target ?? ""]: true } } : {}),
	};
	const written = await jmapCall(session, [
		[
			"Email/set",
			{
				accountId: session.accountId,
				...(destroy
					? { destroy: [input.id] }
					: { update: { [input.id]: update } }),
			},
			"s",
		],
	]);
	const result = methodResult(written, "s", "Email/set", emailSetSchema);
	const ok = destroy
		? (result.destroyed ?? []).includes(input.id)
		: result.updated !== null &&
			result.updated !== undefined &&
			input.id in result.updated;
	if (!ok) {
		throw new Error("the server refused the change");
	}
	return {
		left: destroy || move,
		movedTo: move ? (target ?? null) : null,
		destroyed: destroy,
	};
}
