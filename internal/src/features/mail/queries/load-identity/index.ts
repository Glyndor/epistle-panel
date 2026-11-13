import "server-only";

import { z } from "zod";

import { jmapCall, methodResult } from "@/features/mail/jmap/call";
import type { MailSession } from "@/features/mail/jmap/credentials";

const identitySchema = z.object({
	list: z.array(
		z.object({
			id: z.string(),
			name: z.string().nullable().optional(),
			email: z.string(),
		}),
	),
});

/** The address and name a message is sent from. */
export interface Sender {
	readonly name: string | undefined;
	readonly email: string;
}

/**
 * The sender: the account's first sending identity. epistle lists one per
 * address the account owns, and refuses a `From` it does not own, so the
 * composer never takes the sender from the browser.
 */
export async function loadSender(session: MailSession): Promise<Sender | null> {
	const responses = await jmapCall(session, [
		["Identity/get", { accountId: session.accountId, ids: null }, "i"],
	]);
	const first = methodResult(responses, "i", "Identity/get", identitySchema)
		.list[0];
	return first === undefined
		? null
		: { name: first.name ? first.name : undefined, email: first.email };
}
