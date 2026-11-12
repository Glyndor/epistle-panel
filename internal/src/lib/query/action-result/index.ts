/** Why a Server Action could not give the data asked of it. */
export type ActionFailure = "unauthenticated" | "unavailable" | "invalid";

/**
 * What a Server Action that backs a query or a mutation returns: the data, or
 * the reason there is none. A union and not a flag, so the caller has to look at
 * `ok` before it can reach `data`, and an action never returns a raw error (an
 * API error can carry recipients, queue names and server paths). The action
 * keeps the detail in the server log.
 */
export type ActionResult<T> =
	| { readonly ok: true; readonly data: T }
	| { readonly ok: false; readonly reason: ActionFailure };

/** Thrown on the client when an action reported a failure, so Query sees an error. */
export class ActionError extends Error {
	readonly reason: ActionFailure;

	constructor(reason: ActionFailure) {
		super(`action failed: ${reason}`);
		this.name = "ActionError";
		this.reason = reason;
	}
}

/** The data of a successful result; a failure becomes an {@link ActionError}. */
export function unwrap<T>(result: ActionResult<T>): T {
	if (result.ok) {
		return result.data;
	}
	throw new ActionError(result.reason);
}

/** Make a `switch` over a union exhaustive: the compiler fails when a case is missing. */
export function assertNever(value: never): never {
	throw new Error(`unhandled case: ${String(value)}`);
}
