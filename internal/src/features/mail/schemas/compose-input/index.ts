import { z } from "zod";
import {
	MAX_COMPOSE_ATTACHMENTS,
	MAX_COMPOSE_TEXT,
	MAX_SUBJECT,
} from "@/features/mail/schemas/compose-input-limits";
import { messageIdSchema } from "@/features/mail/schemas/mail-input";
import { isAddress, MAX_RECIPIENTS } from "@/features/mail/schemas/recipients";

const control = /^[^\p{Cc}\p{Zl}\p{Zp}‪-‮⁦-⁩]*$/u;

const recipientSchema = z.strictObject({
	name: z.string().max(200).regex(control).optional(),
	email: z.string().refine(isAddress),
});

const recipientsSchema = z.array(recipientSchema).max(MAX_RECIPIENTS);

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
 * What the composer sends to save a draft or send a message. Strict: nothing the
 * client adds reaches JMAP. The server is the gate; the form checks the same
 * rules first only to name a field.
 */
export const composeInputSchema = z.strictObject({
	op: z.enum(["draft", "send"]),
	/** The draft this one replaces, once saved. */
	draftId: messageIdSchema.optional(),
	to: recipientsSchema,
	cc: recipientsSchema,
	bcc: recipientsSchema,
	subject: z.string().max(MAX_SUBJECT).regex(control),
	text: z.string().max(MAX_COMPOSE_TEXT),
	attachments: z
		.array(
			z.strictObject({
				blobId: blobIdSchema,
				name: z.string().max(255),
				type: mediaTypeSchema,
			}),
		)
		.max(MAX_COMPOSE_ATTACHMENTS),
	inReplyTo: messageIdText.optional(),
	references: z.array(messageIdText).max(50).optional(),
});
export type ComposeInput = z.output<typeof composeInputSchema>;
