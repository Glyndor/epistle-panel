import { z } from "zod";

import {
	isKeywordAtom,
	isLabelKeyword,
} from "@/features/mail/labels/keyword-codec";
import { validateLabelName } from "@/features/mail/labels/name-codec";
import { LABEL_BATCH } from "@/features/mail/schemas/label-input-model";
import { messageIdSchema } from "@/features/mail/schemas/mail-input";

/**
 * A keyword of a label that already exists, as a message carries it. The same
 * test the display uses to call a keyword a label: an atom the server keeps
 * that is not one of the protocol's (`$seen`, `$flagged`, `\Seen`...), so this
 * action cannot be used to set or take off a flag.
 */
export const labelKeywordSchema = z
	.string()
	.refine((keyword) => isKeywordAtom(keyword) && isLabelKeyword(keyword));

/** A name typed for a new label: the one rule the field and the server share. */
export const labelNameSchema = z.string().refine(validateLabelName);

const ids = z
	.array(messageIdSchema)
	.min(1)
	.max(LABEL_BATCH)
	.refine((list) => new Set(list).size === list.length);

/**
 * Input of the label action: the messages, and either an existing label put on
 * them or taken off (always by its keyword, which is its identity, never by a
 * name written again), or a label made from a name and put on them. Strict, so
 * nothing the client adds reaches JMAP.
 */
export const labelMessagesInputSchema = z.discriminatedUnion("kind", [
	z.strictObject({
		kind: z.literal("keyword"),
		ids,
		keyword: labelKeywordSchema,
		on: z.boolean(),
	}),
	z.strictObject({
		kind: z.literal("create"),
		ids,
		name: labelNameSchema,
	}),
]);
export type LabelMessagesInput = z.output<typeof labelMessagesInputSchema>;
