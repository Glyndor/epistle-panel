import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";
import { readSecret } from "@/lib/config/secret";

/**
 * Who the webmail acts for and the credential it presents to epistle's JMAP.
 * This is the single place that decides both: everything else in the webmail
 * receives a `MailSession` and never reads a cookie or a secret itself, so the
 * day the credential becomes a per-user token (OAuth with PKCE against
 * epistle's `/oauth`) only the provider below changes.
 */
export interface MailSession {
	/** The JMAP account id, which epistle makes the account name. */
	readonly accountId: string;
	/** The bearer sent to JMAP. It stays on the server and is never returned to a browser. */
	readonly bearer: string;
}

/** Where a `MailSession` comes from. */
export interface MailCredentialProvider {
	/** The session for the current request, or `null` when there is no signed-in user. */
	current(): Promise<MailSession | null>;
}

/**
 * The provider used until the end-user sign-in exists: the panel's own session
 * names the account, and the panel's API token is the bearer. That token is
 * the operator's, so this provider is only fit for an account whose owner is
 * the operator, so it is given only to a session with the admin role and the
 * session of any other role gets nothing: the operator's token never acts for an
 * end user. The webmail becomes usable by other users with a token bound to
 * their account (see docs/maintainers/mail.md).
 */
export const interimProvider: MailCredentialProvider = {
	async current() {
		const session = await verifySession(
			(await cookies()).get(SESSION_COOKIE)?.value,
		);
		if (session?.role !== "admin") {
			return null;
		}
		const bearer = await readSecret("EPISTLE_API_TOKEN").catch(
			() => undefined,
		);
		return bearer ? { accountId: session.sub, bearer } : null;
	},
};

let provider: MailCredentialProvider = interimProvider;

/** Replace the provider, for the end-user sign-in once it exists and for tests. */
export function setMailCredentialProvider(next: MailCredentialProvider): void {
	provider = next;
}

/** The session of the current request, as the configured provider gives it. */
export function currentMailSession(): Promise<MailSession | null> {
	return provider.current();
}
