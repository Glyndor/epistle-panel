import "server-only";

import type {
	Outcome,
	Refusal,
} from "@/features/account-detail/schemas/outcome";
import { EpistleApiError } from "@/lib/api/client";

/** The refusal an API status stands for, or `undefined` for one that is a failure. */
function refusalOf(status: number): Refusal | undefined {
	switch (status) {
		case 400:
			return "rejected";
		case 404:
			return "notFound";
		case 409:
			return "conflict";
		default:
			return undefined;
	}
}

/**
 * Run an API call and turn a refusal the person can act on (`400`, `404`,
 * `409`) into its category. Everything else, a timeout, a `5xx`, a `401` for the
 * panel's own token, a body that does not parse, is rethrown for the action to
 * log and report as `unavailable`. The API's message is dropped here: it can
 * quote what was sent.
 */
export async function settle<T>(call: () => Promise<T>): Promise<Outcome<T>> {
	try {
		return { kind: "done", value: await call() };
	} catch (error) {
		const refusal =
			error instanceof EpistleApiError
				? refusalOf(error.status)
				: undefined;
		if (refusal === undefined) {
			throw error;
		}
		return { kind: refusal };
	}
}
