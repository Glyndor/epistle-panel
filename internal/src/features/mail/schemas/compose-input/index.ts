import { z } from "zod";
import type { ComposeLimits } from "@/features/mail/schemas/compose-input-limits";
import { messageIdSchema } from "@/features/mail/schemas/mail-input";
import { isAddress } from "@/features/mail/schemas/recipients";

const control = /^[^\p{Cc}\p{Zl}\p{Zp}‪-‮⁦-⁩]*$/u;

const recipientSchema = z.strictObject({
	name: z.string().max(200).regex(control).optional(),
	email: z.string().refine(isAddress),
});

/**
 * The id of a blob as epistle issues it, never a path: an upload's id, or the
 * part of a stored message as `<message id>.<part index>`, the form epistle
 * writes in `bodyStructure` and splits on the dot when the blob is reused
 * (a draft's attachment, edited and saved again).
 */
export const blobIdSchema = z
	.string()
	.regex(/^[0-9a-fA-F-]{8,64}(?:\.[0-9]{1,6})?$/);

/** A media type in its plain `type/subtype` form. */
export const mediaTypeSchema = z
	.string()
	.regex(
		/^[a-z0-9][a-z0-9!#$&^_.+-]{0,60}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,100}$/,
	);

/** A message-id as it sits between angle brackets: no space, bracket or control. */
const messageIdText = z
	.string()
	.max(255)
	.regex(/^[^\s<>\p{C}]+$/u);

/**
 * What sending does to the message it came from: a reply marks it answered, a forward marks it forwarded. */
export const ORIGIN_MARKS = ["answered", "forwarded"] as const;
export type OriginMark = (typeof ORIGIN_MARKS)[number];

/**
 * What the composer sends to save a draft or send a message. Strict: nothing the
 * client adds reaches JMAP. The server is the gate; the form checks the same
 * rules first only to name a field.
 *
 * The schema is built from the limits the mail server publishes, so the form
 * and the route hold the same numbers.
 */
export function composeInputSchema(limits: ComposeLimits) {
	const recipientsSchema = z.array(recipientSchema).max(limits.maxRecipients);
	return z.strictObject({
		op: z.enum(["draft", "send"]),
		/** The draft this one replaces, once saved. */
		draftId: messageIdSchema.optional(),
		to: recipientsSchema,
		cc: recipientsSchema,
		bcc: recipientsSchema,
		subject: z.string().max(limits.maxSubject).regex(control),
		text: z.string().max(limits.maxText),
		attachments: z
			.array(
				z.strictObject({
					blobId: blobIdSchema,
					name: z.string().max(255),
					type: mediaTypeSchema,
				}),
			)
			.max(limits.maxAttachments),
		inReplyTo: messageIdText.optional(),
		references: z.array(messageIdText).max(50).optional(),
		/** The message this one answers or forwards, marked so once this one is sent. */
		origin: z
			.strictObject({
				id: messageIdSchema,
				as: z.enum(ORIGIN_MARKS),
			})
			.optional(),
	});
}

export type ComposeInput = z.output<ReturnType<typeof composeInputSchema>>;
