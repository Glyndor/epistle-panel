import { z } from "zod";

/** A JMAP address, `{name, email}`; epistle sends `null` for a missing name. */
const addressSchema = z.object({
	name: z.string().nullable().optional(),
	email: z.string(),
});

const addressesSchema = z.array(addressSchema).nullable().optional();

/** `Mailbox/get`: what the folder tree needs. */
export const mailboxGetSchema = z.object({
	list: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			parentId: z.string().nullable().optional(),
			role: z.string().nullable().optional(),
			totalEmails: z.number().int().nonnegative(),
			unreadEmails: z.number().int().nonnegative(),
		}),
	),
});

/** `Mailbox/get` asked for the roles only, to find a system folder by its role. */
export const mailboxRolesSchema = z.object({
	list: z.array(
		z.object({ id: z.string(), role: z.string().nullable().optional() }),
	),
});

/** `Email/query`: the ids of a mailbox, newest first. epistle returns every id, with no paging. */
export const emailQuerySchema = z.object({
	ids: z.array(z.string()),
});

/** One MIME part as `bodyStructure`, `attachments` and the body lists describe it. */
const partSchema = z.object({
	partId: z.string().nullable().optional(),
	blobId: z.string().nullable().optional(),
	size: z.number().int().nonnegative().optional(),
	name: z.string().nullable().optional(),
	type: z.string().optional(),
	disposition: z.string().nullable().optional(),
	cid: z.string().nullable().optional(),
	headers: z
		.array(z.object({ name: z.string(), value: z.string() }))
		.optional(),
});
export type Part = z.infer<typeof partSchema>;

/** The fields of an Email the list and the reader read. Anything else the server sends is ignored. */
const emailSchema = z.object({
	id: z.string(),
	receivedAt: z.string(),
	subject: z.string().nullable().optional(),
	from: addressesSchema,
	to: addressesSchema,
	cc: addressesSchema,
	bcc: addressesSchema,
	replyTo: addressesSchema,
	keywords: z.record(z.string(), z.boolean()).optional(),
	preview: z.string().optional(),
	hasAttachment: z.boolean().optional(),
	mailboxIds: z.record(z.string(), z.boolean()).optional(),
	messageId: z.array(z.string()).nullable().optional(),
	bodyStructure: partSchema.nullable().optional(),
	textBody: z.array(partSchema).optional(),
	htmlBody: z.array(partSchema).optional(),
	attachments: z.array(partSchema).optional(),
	bodyValues: z
		.record(
			z.string(),
			z.object({
				value: z.string(),
				isTruncated: z.boolean().optional(),
				isEncodingProblem: z.boolean().optional(),
			}),
		)
		.optional(),
});
export type EmailRecord = z.infer<typeof emailSchema>;

/** `Email/get`. */
export const emailGetSchema = z.object({
	list: z.array(emailSchema),
	notFound: z.array(z.string()).optional(),
});

/** `Email/set`: which updates and destroys the server accepted. */
export const emailSetSchema = z.object({
	updated: z.record(z.string(), z.unknown()).nullable().optional(),
	notUpdated: z.record(z.string(), z.unknown()).nullable().optional(),
	destroyed: z.array(z.string()).nullable().optional(),
	notDestroyed: z.record(z.string(), z.unknown()).nullable().optional(),
	created: z.record(z.string(), z.unknown()).nullable().optional(),
	notCreated: z.record(z.string(), z.unknown()).nullable().optional(),
});

/** `EmailSubmission/set`: what was queued and what was refused, with the SetError type. */
export const submissionSetSchema = z.object({
	created: z.record(z.string(), z.unknown()).nullable().optional(),
	notCreated: z
		.record(
			z.string(),
			z.object({
				type: z.string(),
				description: z.string().nullable().optional(),
			}),
		)
		.nullable()
		.optional(),
});

/** `Email/set` as a create sees it: the id issued, or the SetError type. */
export const emailCreateSchema = z.object({
	created: z
		.record(z.string(), z.object({ id: z.string() }))
		.nullable()
		.optional(),
	notCreated: z
		.record(z.string(), z.object({ type: z.string() }))
		.nullable()
		.optional(),
	destroyed: z.array(z.string()).nullable().optional(),
});
