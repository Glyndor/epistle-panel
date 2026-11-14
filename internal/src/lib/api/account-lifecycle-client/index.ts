import "server-only";

import { request } from "../request";
import {
	type AccountCreated,
	type AccountName,
	type AccountRemoved,
	accountCreatedSchema,
	accountNameSchema,
	accountRemovedSchema,
	QUEUE_CHOICES,
	type QueueChoice,
} from "../schemas";

/** What a new account is made of. The password travels only in the request body. */
export interface NewAccount {
	readonly name: AccountName;
	readonly addresses: readonly string[];
	readonly password: string;
	/** The person's name; left out of the request when empty. */
	readonly displayName: string;
}

/**
 * Create an API-managed account. The server checks, in order, that the
 * addresses are in hosted domains, that the name is free, the password policy
 * (its breach list included) and then stores it; a refusal is a `400` or a
 * `409` with a message that can quote what was sent, so callers keep only the
 * status.
 */
export async function createAccount(
	account: NewAccount,
): Promise<AccountCreated> {
	return request("/api/v1/accounts", accountCreatedSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			name: accountNameSchema.parse(account.name),
			addresses: account.addresses,
			password: account.password,
			...(account.displayName === ""
				? {}
				: { display_name: account.displayName }),
		}),
	});
}

/**
 * Delete an API-managed account with everything it owns. `queue` is required
 * by the API so queued mail is never dropped by omission: `drain` leaves it to
 * be delivered, `discard` drops it. An account declared in the configuration
 * file is not the API's to delete and answers `404`. The name is checked here
 * as well, so nothing that is not an account name becomes a path segment.
 */
export async function deleteAccount(
	name: AccountName,
	queue: QueueChoice,
): Promise<AccountRemoved> {
	if (!QUEUE_CHOICES.includes(queue)) {
		throw new TypeError("unknown queue choice");
	}
	return request(
		`/api/v1/accounts/${accountNameSchema.parse(name)}?queue=${queue}`,
		accountRemovedSchema,
		{ method: "DELETE" },
	);
}
