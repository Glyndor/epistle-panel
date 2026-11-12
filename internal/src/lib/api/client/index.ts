import "server-only";

import { EpistleApiError } from "../error";
import { request } from "../request";
import {
	type Accounts,
	accountsSchema,
	type Domains,
	domainsSchema,
	type QueuePage,
	queuePageSchema,
	type Removed,
	type RemovedAddress,
	removedAddressSchema,
	removedSchema,
	type Status,
	type SuppressionPage,
	statusSchema,
	suppressionPageSchema,
	type VerifyResult,
	verifyResultSchema,
} from "../schemas";

export { EpistleApiError };

/**
 * Time budget of `verifyCredentials`, in milliseconds. Longer than an ordinary
 * call because the mail server hashes the operator's password with argon2id.
 */
export const VERIFY_TIMEOUT_MS = 30_000;

/** Fetch the server status. */
export function getStatus(): Promise<Status> {
	return request("/api/v1/status", statusSchema);
}

/** List the configured domains. */
export function getDomains(): Promise<Domains> {
	return request("/api/v1/domains", domainsSchema);
}

/** List the mail accounts. */
export function getAccounts(): Promise<Accounts> {
	return request("/api/v1/accounts", accountsSchema);
}

/** Fetch one page of the outbound queue, from `cursor` when given. */
export function getQueue(params?: {
	limit?: number;
	cursor?: string;
}): Promise<QueuePage> {
	const query = new URLSearchParams();
	if (params?.limit !== undefined) {
		query.set("limit", String(params.limit));
	}
	if (params?.cursor !== undefined) {
		query.set("cursor", params.cursor);
	}
	const suffix = query.size > 0 ? `?${query}` : "";
	return request(`/api/v1/queue${suffix}`, queuePageSchema);
}

/** Remove one entry from the outbound queue by id. */
export function removeQueueEntry(id: string): Promise<Removed> {
	return request(`/api/v1/queue/${encodeURIComponent(id)}`, removedSchema, {
		method: "DELETE",
	});
}

/**
 * Fetch one page of the global suppression list, the addresses after `after`
 * when given. The panel's token is unconfined, so the global list is allowed.
 */
export function getSuppression(params?: {
	limit?: number;
	after?: string;
}): Promise<SuppressionPage> {
	const query = new URLSearchParams();
	if (params?.limit !== undefined) {
		query.set("limit", String(params.limit));
	}
	if (params?.after !== undefined) {
		query.set("after", params.after);
	}
	const suffix = query.size > 0 ? `?${query}` : "";
	return request(`/api/v1/suppression${suffix}`, suppressionPageSchema);
}

/** Take one address off the global suppression list. Answers 200 when it was not there. */
export function removeSuppression(address: string): Promise<RemovedAddress> {
	return request(
		`/api/v1/suppression/${encodeURIComponent(address)}`,
		removedAddressSchema,
		{ method: "DELETE" },
	);
}

/**
 * Verify operator credentials against the mail server and report whether the
 * account may administer the panel. Runs on the server only; the bearer token
 * and the operator's password never reach the browser.
 */
export function verifyCredentials(
	name: string,
	password: string,
): Promise<VerifyResult> {
	return request(
		"/api/v1/auth/verify",
		verifyResultSchema,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ name, password }),
		},
		VERIFY_TIMEOUT_MS,
	);
}
