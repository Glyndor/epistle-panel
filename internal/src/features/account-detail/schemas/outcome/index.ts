/**
 * Why the mail server refused a change it understood: the input was not
 * acceptable (`rejected`, a `400`), the account or the item is gone (`notFound`,
 * a `404`) or a limit was reached (`conflict`, a `409`). Only the category
 * leaves the server: the API's own message echoes what was sent, a password
 * included, so it is never forwarded.
 */
export type Refusal = "rejected" | "notFound" | "conflict";

/** What an account action reports: the value, or the category of the refusal. */
export type Outcome<T> =
	| { readonly kind: "done"; readonly value: T }
	| { readonly kind: Refusal };
