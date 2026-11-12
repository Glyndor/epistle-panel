import "server-only";

import { ConfigError } from "@/lib/config/config-error";

import { EpistleApiError } from "../error";

/** An API error code is logged only when it looks like a code, not like prose. */
const SAFE_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

/**
 * The class name of a thrown value. Read off `name` rather than `instanceof
 * Error`: a `ZodError` from schema validation is not an `Error` instance.
 */
function errorName(error: unknown): string {
	if (typeof error === "object" && error !== null && "name" in error) {
		const { name } = error;
		if (typeof name === "string" && SAFE_CODE.test(name)) {
			return name;
		}
	}
	return "unknown";
}

/**
 * Describe a failed API call for the server log without the content of the
 * failure.
 *
 * The message of an API error, the URL of the request and the text of a network
 * or schema error can carry recipients, queue names and server paths, and the
 * container log outlives the request. So the line holds the operation name and
 * the HTTP status plus the API's error code for an API error, the panel's own
 * message for a `ConfigError` (it never carries a value), and only the error
 * class name for anything else.
 */
export function describeFailure(operation: string, error: unknown): string {
	if (error instanceof EpistleApiError) {
		const code = SAFE_CODE.test(error.code) ? error.code : "invalid";
		return `${operation} failed: status=${error.status} code=${code}`;
	}
	if (error instanceof ConfigError) {
		return `${operation} failed: ${error.message}`;
	}
	return `${operation} failed: error=${errorName(error)}`;
}

/** Write `describeFailure` to the server log. Call sites pass a fixed operation name. */
export function logApiFailure(operation: string, error: unknown): void {
	console.error(describeFailure(operation, error));
}
