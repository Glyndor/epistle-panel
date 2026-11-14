import type { ComposeMode } from "@/features/mail/queries/compose-prefill";
import { messageIdSchema } from "@/features/mail/schemas/mail-input";

const FROM_MESSAGE = ["reply", "replyAll", "forward", "draft"] as const;

const first = (value: string | string[] | undefined) =>
	Array.isArray(value) ? value[0] : value;

/**
 * What the composer's address asks for: `?mode=reply|replyAll|forward|draft`
 * with `&msg=<id>`, each parameter checked on its own. A mode without a
 * message that is an id, and anything else, is an empty composer.
 */
export function composeRequest(
	params: Readonly<Record<string, string | string[] | undefined>>,
): { mode: ComposeMode; message: string | undefined } {
	const mode = FROM_MESSAGE.find((value) => value === first(params["mode"]));
	const id = messageIdSchema.safeParse(first(params["msg"]));
	return mode !== undefined && id.success
		? { mode, message: id.data }
		: { mode: "new", message: undefined };
}

/** The key of the `mail` messages that titles the composer in each mode. */
export const COMPOSE_TITLE = {
	new: "composeTitle",
	reply: "replyTitle",
	replyAll: "replyTitle",
	forward: "forwardTitle",
	draft: "editDraftTitle",
} as const satisfies Record<ComposeMode, string>;
