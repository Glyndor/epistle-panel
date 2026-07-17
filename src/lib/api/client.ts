import "server-only";

import type { z } from "zod";

import {
	type Accounts,
	accountsSchema,
	apiErrorSchema,
	type Domains,
	domainsSchema,
	type QueuePage,
	queuePageSchema,
	type Removed,
	removedSchema,
	type Status,
	statusSchema,
	type VerifyResult,
	verifyResultSchema,
} from "./schemas";

/** Raised for any non-2xx response from the Epistle management API. */
export class EpistleApiError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(status: number, code: string, message: string) {
		super(message);
		this.name = "EpistleApiError";
		this.status = status;
		this.code = code;
	}
}

function baseUrl(): string {
	return process.env.EPISTLE_API_URL ?? "http://127.0.0.1:8025";
}

function token(): string {
	const value = process.env.EPISTLE_API_TOKEN;
	if (!value) {
		throw new Error("EPISTLE_API_TOKEN is not configured");
	}
	return value;
}

/**
 * Call the Epistle management API and validate the response shape.
 *
 * Runs on the server only: the bearer token never reaches the browser.
 */
async function request<T>(
	path: string,
	schema: z.ZodType<T>,
	init?: RequestInit,
): Promise<T> {
	const response = await fetch(`${baseUrl()}${path}`, {
		...init,
		headers: {
			...init?.headers,
			Authorization: `Bearer ${token()}`,
			Accept: "application/json",
		},
		cache: "no-store",
	});

	const body: unknown = await response.json();
	if (!response.ok) {
		const parsed = apiErrorSchema.safeParse(body);
		if (parsed.success) {
			throw new EpistleApiError(
				response.status,
				parsed.data.error.code,
				parsed.data.error.message,
			);
		}
		throw new EpistleApiError(
			response.status,
			"unknown",
			"Unexpected error shape",
		);
	}
	return schema.parse(body);
}

export function getStatus(): Promise<Status> {
	return request("/api/v1/status", statusSchema);
}

export function getDomains(): Promise<Domains> {
	return request("/api/v1/domains", domainsSchema);
}

export function getAccounts(): Promise<Accounts> {
	return request("/api/v1/accounts", accountsSchema);
}

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

export function removeQueueEntry(id: string): Promise<Removed> {
	return request(`/api/v1/queue/${encodeURIComponent(id)}`, removedSchema, {
		method: "DELETE",
	});
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
	return request("/api/v1/auth/verify", verifyResultSchema, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ name, password }),
	});
}
