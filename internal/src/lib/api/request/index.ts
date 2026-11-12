import "server-only";

import type { z } from "zod";

import { apiBaseUrl } from "@/lib/config/api-url";
import { ConfigError } from "@/lib/config/config-error";
import { readSecret } from "@/lib/config/secret";

import { EpistleApiError, EpistleApiTimeoutError } from "../error";
import { readJsonBody } from "../read-body";
import { apiErrorSchema } from "../schemas";

/** Time budget of an ordinary API call, in milliseconds. */
export const REQUEST_TIMEOUT_MS = 10_000;

async function token(): Promise<string> {
	const value = await readSecret("EPISTLE_API_TOKEN");
	if (!value) {
		throw new ConfigError("EPISTLE_API_TOKEN is not configured");
	}
	return value;
}

/**
 * Call the Epistle management API and validate the response shape.
 *
 * Runs on the server only: the bearer token never reaches the browser.
 *
 * The base URL is validated before anything else, so a refused
 * `EPISTLE_API_URL` makes the call fail without a request and without reading
 * the token. The whole exchange, headers and body, shares one `timeoutMs`
 * budget, and the body is read through a byte cap. Redirects are refused: the
 * API never redirects, and following one would send the token somewhere the
 * configuration did not name.
 *
 * Throws `EpistleApiTimeoutError` when the budget runs out,
 * `EpistleApiResponseTooLargeError` over the body cap, and `EpistleApiError`
 * for a non-2xx answer.
 */
export async function request<T>(
	path: string,
	schema: z.ZodType<T>,
	init?: RequestInit,
	timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> {
	const url = `${apiBaseUrl()}${path}`;
	const authorization = `Bearer ${await token()}`;
	const signal = AbortSignal.timeout(timeoutMs);

	// `new Headers` takes a plain object, a `Headers` or a list of pairs, which
	// a spread would drop or mangle; the two below replace any the caller sent.
	const headers = new Headers(init?.headers);
	headers.set("Authorization", authorization);
	headers.set("Accept", "application/json");

	let body: unknown;
	let response: Response;
	try {
		response = await fetch(url, {
			...init,
			headers,
			cache: "no-store",
			redirect: "error",
			signal,
		});
		body = await readJsonBody(response);
	} catch (error) {
		if (signal.aborted) {
			throw new EpistleApiTimeoutError();
		}
		throw error;
	}

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
