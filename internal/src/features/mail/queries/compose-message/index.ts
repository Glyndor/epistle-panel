import "server-only";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";
import {
	emailCreateSchema,
	emailGetSchema,
	mailboxRolesSchema,
	submissionSetSchema,
} from "@/features/mail/jmap/responses";
import { loadSender } from "@/features/mail/queries/load-identity";
import { markOrigin } from "@/features/mail/queries/mark-origin";
import { safeFilename } from "@/features/mail/sanitize/safe-filename";
import type { ComposeInput } from "@/features/mail/schemas/compose-input";

/** Why a message was not sent or saved, as a closed category the form can say. */
export type ComposeRefusal =
	| "noRecipients"
	| "tooManyRecipients"
	| "forbiddenFrom"
	| "invalidEmail"
	| "overQuota"
	| "rateLimit"
	| "forbiddenToSend"
	| "tooLarge"
	| "invalid"
	| "serverFail";

/** What composing answered. */
export type ComposeResult =
	| { readonly kind: "draft"; readonly id: string }
	| { readonly kind: "sent" }
	/** Not sent; the work is kept as the draft `draftId` when one could be saved. */
	| {
			readonly kind: "refused";
			readonly reason: ComposeRefusal;
			readonly draftId: string | null;
	  }
	| { readonly kind: "noSender" };

const REFUSALS: Record<string, ComposeRefusal> = {
	noRecipients: "noRecipients",
	tooManyRecipients: "tooManyRecipients",
	forbiddenFrom: "forbiddenFrom",
	invalidEmail: "invalidEmail",
	overQuota: "overQuota",
	rateLimit: "rateLimit",
	forbiddenToSend: "forbiddenToSend",
	tooLarge: "tooLarge",
	invalidProperties: "invalid",
};

/** The closed category of a SetError type; anything unknown is a server failure. */
export function refusalOf(type: string): ComposeRefusal {
	return Object.hasOwn(REFUSALS, type)
		? (REFUSALS[type] ?? "serverFail")
		: "serverFail";
}

const asIds = (ids: readonly string[] | undefined) =>
	ids === undefined || ids.length === 0
		? undefined
		: ids.map((id) => id.replace(/^<|>$/g, ""));

/**
 * Whether `id` is a draft of this account: it exists in the account, carries
 * `$draft` and sits in the drafts folder. Replacing a draft destroys the old one,
 * so an id that is anything else (a normal message, another account's, nothing)
 * must never reach a destroy.
 */
async function isDraft(
	session: MailSession,
	id: string,
	drafts: string,
): Promise<boolean> {
	const responses = await jmapCall(session, [
		[
			"Email/get",
			{
				accountId: session.accountId,
				ids: [id],
				properties: ["id", "keywords", "mailboxIds"],
				bodyProperties: ["partId"],
			},
			"d",
		],
	]);
	const email = methodResult(responses, "d", "Email/get", emailGetSchema)
		.list[0];
	return (
		email !== undefined &&
		email.keywords?.["$draft"] === true &&
		email.mailboxIds?.[drafts] === true
	);
}

/** The Email object to create for `input`, from `sender`, into the drafts folder. */
function emailFor(
	input: ComposeInput,
	sender: { name: string | undefined; email: string },
	drafts: string,
) {
	const references = asIds(input.references);
	return {
		mailboxIds: { [drafts]: true },
		keywords: { $draft: true, $seen: true },
		from: [sender.name === undefined ? { email: sender.email } : sender],
		to: input.to,
		cc: input.cc,
		bcc: input.bcc,
		subject: input.subject,
		textBody: [{ partId: "t", type: "text/plain" }],
		bodyValues: { t: { value: input.text } },
		...(input.attachments.length > 0
			? {
					attachments: input.attachments.map((a) => ({
						blobId: a.blobId,
						type: a.type,
						// The name ends up in MIME headers: one clean path segment, as for a download.
						name: safeFilename(a.name),
						disposition: "attachment",
					})),
				}
			: {}),
		...(input.inReplyTo === undefined
			? {}
			: { inReplyTo: [input.inReplyTo.replace(/^<|>$/g, "")] }),
		...(references === undefined ? {} : { references }),
	};
}

/**
 * Save a draft, or send. A draft is a new message in the drafts folder that
 * replaces the previous one (epistle cannot edit a stored message). Sending
 * stores the message the same way, queues it with `EmailSubmission/set` (which
 * takes the recipients from To, Cc and Bcc and keeps its own copy in Sent), and
 * then removes the working copy and the previous draft. If the server refuses
 * to send, the work stays as the draft, and the answer says why.
 */
export async function composeMessage(
	session: MailSession,
	input: ComposeInput,
): Promise<ComposeResult> {
	const sender = await loadSender(session);
	if (sender === null) {
		return { kind: "noSender" };
	}
	const boxes = await jmapCall(session, [
		[
			"Mailbox/get",
			{
				accountId: session.accountId,
				ids: null,
				properties: ["id", "role"],
			},
			"m",
		],
	]);
	const drafts =
		methodResult(boxes, "m", "Mailbox/get", mailboxRolesSchema).list.find(
			(b) => b.role === "drafts",
		)?.id ?? "Drafts";

	if (
		input.draftId !== undefined &&
		!(await isDraft(session, input.draftId, drafts))
	) {
		return { kind: "refused", reason: "invalid", draftId: null };
	}

	const created = await jmapCall(session, [
		[
			"Email/set",
			{
				accountId: session.accountId,
				create: { c: emailFor(input, sender, drafts) },
			},
			"e",
		],
	]);
	const set = methodResult(created, "e", "Email/set", emailCreateSchema);
	const id = set.created?.["c"]?.id;
	if (id === undefined) {
		return {
			kind: "refused",
			reason: refusalOf(set.notCreated?.["c"]?.type ?? "serverFail"),
			draftId: null,
		};
	}

	if (input.op === "draft") {
		await destroy(session, input.draftId);
		return { kind: "draft", id };
	}

	const submitted = await jmapCall(session, [
		[
			"EmailSubmission/set",
			{ accountId: session.accountId, create: { s: { emailId: id } } },
			"s",
		],
	]);
	const outcome = methodResult(
		submitted,
		"s",
		"EmailSubmission/set",
		submissionSetSchema,
	);
	if (outcome.created?.["s"] === undefined) {
		const type = outcome.notCreated?.["s"]?.type ?? "serverFail";
		await destroy(session, input.draftId);
		return { kind: "refused", reason: refusalOf(type), draftId: id };
	}
	await destroy(session, id);
	await destroy(session, input.draftId);
	await markOrigin(session, input.origin);
	return { kind: "sent" };
}

/** Remove a stored message; a failure is not the caller's problem, the message just stays. */
async function destroy(
	session: MailSession,
	id: string | undefined,
): Promise<void> {
	if (id === undefined) {
		return;
	}
	try {
		await jmapCall(session, [
			["Email/set", { accountId: session.accountId, destroy: [id] }, "d"],
		]);
	} catch {
		// Left in the drafts folder; the reader can delete it.
	}
}
