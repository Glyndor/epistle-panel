import "server-only";

import type { MailSession } from "@/features/mail/jmap/credentials";
import { readSessionCapabilities } from "@/features/mail/jmap/session";
import {
	type ComposeLimits,
	composeLimits,
} from "@/features/mail/schemas/compose-input-limits";

/**
 * The limits the composer works with for `session`: what the mail server
 * publishes in its JMAP session, and the panel's own for what the server does
 * not publish.
 *
 * The session is asked once per request that needs the limits (the composer
 * page, the compose route and the upload route): it is a small answer, and the
 * limits it carries are what the server will accept, so the panel must not
 * hold numbers of its own where the server speaks.
 */
export async function loadComposeLimits(
	session: MailSession,
): Promise<ComposeLimits> {
	return composeLimits(await readSessionCapabilities(session));
}
