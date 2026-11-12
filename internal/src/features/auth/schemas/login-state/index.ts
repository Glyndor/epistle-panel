/**
 * What the sign-in action reports back to its form, as a union and not a pair of
 * flags. `failed` covers bad credentials, an account that is not an admin, an
 * unreachable API and any input the schema refuses, all with the same message so
 * the answer reveals nothing. `throttled` says only that the limiter refused the
 * attempt before the API was called, whichever name was sent.
 */
export type LoginState =
	| { readonly outcome: "idle" }
	| { readonly outcome: "failed" }
	| { readonly outcome: "throttled" };

/** The state before the first attempt. */
export const INITIAL_LOGIN_STATE: LoginState = { outcome: "idle" };
