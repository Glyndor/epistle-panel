/**
 * Creating and deleting accounts, as the epistle API does it
 * (`POST /api/v1/accounts`, `DELETE /api/v1/accounts/{name}?queue=`): the same
 * order of checks, the same status for each refusal, and messages that quote
 * what was sent, the way the real ones can, so a scenario can prove the panel
 * never forwards them. The password is checked and then forgotten: it is in no
 * state and no log.
 */
import { apiError, json } from "../responses";

/** The store this module adds accounts to and removes them from. */
export interface AccountsRegistry {
	kind(name: string): "dynamic" | "file" | "none";
	addressesInUse(): Set<string>;
	add(name: string, displayName: string | null, addresses: string[]): void;
	remove(name: string): void;
	list(): unknown[];
}

/** The one domain the stand-in hosts. */
export const HOSTED_DOMAIN = "example.test";

/** Most accounts the stand-in holds, its `max_accounts`: the seed ones and a few more. */
export const MAX_ACCOUNTS = 6;

/** The stand-in's breach list. */
export const BREACHED_PASSWORD = "password-is-breached";

/** An account whose name starts with this has two messages queued when it is deleted. */
export const BUSY_PREFIX = "busy";

const NAME = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PRINTABLE = /^[\x20-\x7e]{12,64}$/;

const invalid = (message: string) => apiError(400, "invalid_input", message);

async function create(request: Request, registry: AccountsRegistry): Promise<Response> {
	if (!request.headers.get("content-type")?.includes("application/json")) {
		return new Response("Expected request with `Content-Type: application/json`", { status: 415 });
	}
	let body: Record<string, unknown>;
	try {
		body = (await request.json()) as Record<string, unknown>;
	} catch {
		return new Response("Failed to parse the request body as JSON", { status: 400 });
	}
	const name = typeof body["name"] === "string" ? body["name"].toLowerCase() : "";
	const addresses = Array.isArray(body["addresses"]) ? body["addresses"].filter((a): a is string => typeof a === "string") : [];
	const password = typeof body["password"] === "string" ? body["password"] : "";
	const displayName = typeof body["display_name"] === "string" ? body["display_name"].trim() : null;

	const outside = addresses.find((address) => !address.endsWith(`@${HOSTED_DOMAIN}`));
	if (addresses.length === 0 || outside !== undefined) {
		return invalid(`address ${outside ?? ""} is not in a hosted domain`);
	}
	if (registry.kind(name) !== "none") {
		return invalid(`account ${name} already exists`);
	}
	if (registry.list().length >= MAX_ACCOUNTS) {
		return apiError(409, "conflict", "the tenant is at its max_accounts");
	}
	if (!PRINTABLE.test(password)) {
		return invalid("password must be 12 to 64 printable ASCII characters");
	}
	if (password === BREACHED_PASSWORD) {
		return invalid(`password ${password} is in the breach list`);
	}
	if (!NAME.test(name)) {
		return invalid(`malformed account name ${name}`);
	}
	const taken = addresses.find((address) => registry.addressesInUse().has(address));
	if (taken !== undefined) {
		return invalid(`address ${taken} is already in use`);
	}
	registry.add(name, displayName === "" ? null : displayName, addresses);
	return json({ created: name });
}

function remove(name: string, url: URL, registry: AccountsRegistry): Response {
	const queue = url.searchParams.get("queue");
	if (queue !== "discard" && queue !== "drain") {
		return new Response("Failed to deserialize query string: missing field `queue`", { status: 400 });
	}
	if (registry.kind(name) !== "dynamic") {
		return apiError(404, "not_found", "no such dynamic account");
	}
	registry.remove(name);
	const queued = name.startsWith(BUSY_PREFIX) ? 2 : 0;
	return json({
		removed: name,
		mailbox_files: 1,
		masked_addresses: 0,
		app_passwords: 0,
		suppressed_addresses: 0,
		correspondent_addresses: 0,
		queued_messages_discarded: queue === "discard" ? queued : 0,
		queued_messages_left: queue === "drain" ? queued : 0,
		bayes_tokens_removed: 0,
	});
}

/** Answer the create and delete routes, or `null` for any other request. */
export async function handleLifecycle(request: Request, url: URL, registry: AccountsRegistry): Promise<Response | null> {
	if (url.pathname === "/api/v1/accounts" && request.method === "POST") {
		return create(request, registry);
	}
	const one = /^\/api\/v1\/accounts\/([^/]+)$/.exec(url.pathname);
	if (one && request.method === "DELETE") {
		return remove(decodeURIComponent(one[1] ?? ""), url, registry);
	}
	return null;
}
