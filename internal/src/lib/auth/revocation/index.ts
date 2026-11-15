/**
 * Revoked sessions.
 *
 * Logout adds the session here so a copy of the cookie stops working before its
 * `exp`. The set lives in this process only: it is single-instance state, lost
 * on restart and not shared between replicas, so a revoked session is accepted
 * again by a restarted or second instance until it expires (at most
 * the operator's role lifetime). Running several panel replicas needs a shared
 * store instead.
 *
 * The key is the session's own id, not the token: the panel re-signs a token
 * when the idle clock restarts, so one session travels under several token
 * strings, and a revocation has to name all of them. Only a SHA-256 of the key
 * is kept, never the key itself. The state sits on `globalThis` because the
 * proxy, the server actions and the pages are bundled separately and would
 * otherwise each get their own empty copy of the module.
 */

/**
 * Most revocations kept. At capacity, reject all sessions until the latest
 * unrecorded revocation expires. Bounded storage must never enable replay.
 */
export const MAX_REVOKED_TOKENS = 10_000;

const STORE = Symbol.for("epistle-panel.revoked-sessions");
const OVERFLOW = Symbol.for("epistle-panel.revocation-overflow");

function overflowHolder(): Record<symbol, number | undefined> {
	return globalThis as unknown as Record<symbol, number | undefined>;
}

type Store = Map<string, number>;

function store(): Store {
	const holder = globalThis as unknown as Record<symbol, Store | undefined>;
	holder[STORE] ??= new Map();
	return holder[STORE];
}

async function fingerprint(token: string): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		new TextEncoder().encode(token),
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

/** Drop every entry whose session has expired anyway. */
function prune(revoked: Store, nowSeconds: number): void {
	for (const [key, exp] of revoked) {
		if (exp <= nowSeconds) {
			revoked.delete(key);
		}
	}
}

/**
 * Remember the session `key` as revoked until `exp` (Unix seconds). Hashing
 * finishes before checking capacity, so concurrent sign-outs cannot overshoot
 * the bound. At capacity, a process-wide expiry locks sessions instead of
 * dropping a live revocation. Repeating logout never shortens a revocation.
 */
export async function revokeToken(key: string, exp: number): Promise<void> {
	const hash = await fingerprint(key);
	const revoked = store();
	const now = Math.floor(Date.now() / 1000);
	prune(revoked, now);
	if (exp <= now) {
		return;
	}
	if (revoked.has(hash) || revoked.size < MAX_REVOKED_TOKENS) {
		revoked.set(hash, Math.max(exp, revoked.get(hash) ?? 0));
	} else {
		const holder = overflowHolder();
		holder[OVERFLOW] = Math.max(exp, holder[OVERFLOW] ?? 0);
	}
}

/** Whether the session `key` was revoked and has not yet expired. */
export async function isRevoked(key: string): Promise<boolean> {
	const exp = store().get(await fingerprint(key));
	const now = Math.floor(Date.now() / 1000);
	return (
		(overflowHolder()[OVERFLOW] ?? 0) > now ||
		(exp !== undefined && exp > now)
	);
}

/** Number of revocations held, for tests of the bound. */
export function revokedCount(): number {
	return store().size;
}

/** Forget every revocation. Tests only; nothing in the app calls it. */
export function clearRevocations(): void {
	store().clear();
	delete overflowHolder()[OVERFLOW];
}
