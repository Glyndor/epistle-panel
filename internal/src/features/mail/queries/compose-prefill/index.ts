import "server-only";

import type { ComposeInitial } from "@/features/mail/components/compose-form";
import type { EmailRecord } from "@/features/mail/jmap/responses";
import { attachmentsOf } from "@/features/mail/queries/load-message";
import { rawBodies } from "@/features/mail/queries/message-body";
import { plainTextOf } from "@/features/mail/sanitize/plain-text";
import { safeBody, safeLine } from "@/features/mail/sanitize/safe-text";
import {
	formatRecipients,
	type Recipient,
} from "@/features/mail/schemas/recipients";

/** What a composer can open as. */
export type ComposeMode = "new" | "reply" | "replyAll" | "forward" | "draft";

/** The texts of the prefill that are translated, already in the reader's language. */
export interface PrefillTexts {
	readonly quoteHeader: (name: string, date: string) => string;
	readonly forwardHeader: string;
	readonly from: string;
	readonly to: string;
	readonly date: string;
	readonly subject: string;
}

/** Longest quoted text, in characters. */
export const MAX_QUOTE = 20_000;

const recipients = (list: EmailRecord["from"]): Recipient[] =>
	(list ?? []).flatMap((a) => {
		const email = safeLine(a.email, 254);
		const name = safeLine(a.name ?? "", 200);
		return email === "" ? [] : [name === "" ? { email } : { name, email }];
	});

const sameAddress = (a: Recipient, b: Recipient) =>
	a.email.toLowerCase() === b.email.toLowerCase();

function unique(list: Recipient[]): Recipient[] {
	return list.filter(
		(entry, index) =>
			list.findIndex((other) => sameAddress(entry, other)) === index,
	);
}

function bodyText(email: EmailRecord): string {
	const raw = rawBodies(email);
	const text =
		raw.text !== null
			? safeBody(raw.text)
			: raw.html !== null
				? plainTextOf(raw.html)
				: "";
	return text.length > MAX_QUOTE ? text.slice(0, MAX_QUOTE) : text;
}

/** `Re: ` or `Fwd: ` once, not stacked on one already there. */
function prefixed(prefix: string, subject: string): string {
	return new RegExp(`^${prefix}\\s*:`, "iu").test(subject)
		? subject
		: `${prefix}: ${subject}`;
}

const stripBrackets = (id: string) => id.replace(/^<|>$/g, "");

/**
 * What the composer opens with. A reply goes to the reply-to address, else the
 * sender (reply all adds the other recipients, minus `self`), with the original
 * quoted and `In-Reply-To` and `References` set; a forward carries the original
 * as text with its header lines; a stored draft comes back as it was, attachments
 * included (they stay in the store and are named by blob id). Everything quoted is
 * cleaned text, put in a text area, never markup.
 */
export function composePrefill(
	mode: ComposeMode,
	email: EmailRecord,
	self: string | undefined,
	texts: PrefillTexts,
	formatDate: (iso: string) => string,
): ComposeInitial {
	const subject = safeLine(email.subject ?? "", 998);
	const original = bodyText(email);
	const messageId = email.messageId?.[0]
		? stripBrackets(safeLine(email.messageId[0], 255))
		: undefined;
	const reply = {
		inReplyTo: messageId,
		references: messageId === undefined ? undefined : [messageId],
	};

	if (mode === "draft") {
		return {
			to: formatRecipients(recipients(email.to)),
			cc: formatRecipients(recipients(email.cc)),
			bcc: formatRecipients(recipients(email.bcc)),
			subject,
			text: original,
			draftId: email.id,
			attachments: attachmentsOf(email).flatMap((a) => {
				const part = email.attachments?.find(
					(p) => p.partId === a.part,
				);
				return part?.blobId
					? [
							{
								blobId: part.blobId,
								name: a.name,
								type: a.type,
								size: a.size,
							},
						]
					: [];
			}),
		};
	}
	if (mode === "forward") {
		const header = [
			texts.forwardHeader,
			`${texts.from}: ${formatRecipients(recipients(email.from))}`,
			`${texts.date}: ${formatDate(email.receivedAt)}`,
			`${texts.subject}: ${subject}`,
			`${texts.to}: ${formatRecipients(recipients(email.to))}`,
		].join("\n");
		return {
			to: "",
			cc: "",
			bcc: "",
			subject: prefixed("Fwd", subject),
			text: `\n\n${header}\n\n${original}`.slice(0, 1_000_000),
			origin: { id: email.id, as: "forwarded" },
		};
	}
	const first = recipients(email.replyTo)[0] ?? recipients(email.from)[0];
	const others =
		mode === "replyAll"
			? unique([...recipients(email.to), ...recipients(email.cc)])
			: [];
	const notMe = (r: Recipient) =>
		self === undefined || r.email.toLowerCase() !== self.toLowerCase();
	const to = first === undefined ? [] : [first];
	const cc = others.filter(
		(r) => notMe(r) && !to.some((t) => sameAddress(t, r)),
	);
	const who = first?.name ?? first?.email ?? "";
	const quoted = original
		.split("\n")
		.map((line) => `> ${line}`.trimEnd())
		.join("\n");
	return {
		to: formatRecipients(to),
		cc: formatRecipients(cc),
		bcc: "",
		subject: prefixed("Re", subject),
		text: `\n\n${texts.quoteHeader(who, formatDate(email.receivedAt))}\n${quoted}`,
		...reply,
		origin: { id: email.id, as: "answered" },
	};
}
