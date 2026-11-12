/**
 * Revoked session tokens.
 *
 * Logout adds the token here so a copy of the cookie stops working before its
 * `exp`. The set lives in this process only: it is single-instance state, lost
 * on restart and not shared between replicas, so a revoked token is accepted
 * again by a restarted or second instance until it expires (at most
 * `SESSION_MAX_AGE_SECONDS`). Running several panel replicas needs a shared
 * store instead.
 *
 * Only a SHA-256 of the token is kept, never the token. The state sits on
 * `globalThis` because the proxy, the server actions and the pages are bundled
 * separately and would otherwise each get their own empty copy of the module.
 */

/**
 * Most revocations kept. When the set is full, the entry that expires first is
 * dropped, so the revocations with the longest life left are the last to go.
 */
export const MAX_REVOKED_TOKENS = 10_000;

const STORE = Symbol.for("epistle-panel.revoked-sessions");

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

/** Drop every entry whose token has expired anyway. */
function prune(revoked: Store, nowSeconds: number): void {
	for (const [key, exp] of revoked) {
		if (exp <= nowSeconds) {
			revoked.delete(key);
		}
	}
}

/** Drop the entry that expires first; the earliest inserted wins a tie. */
function evictNearestExpiry(revoked: Store): void {
	let nearest: string | undefined;
	let nearestExp = Number.POSITIVE_INFINITY;
	for (const [key, exp] of revoked) {
		if (exp < nearestExp) {
			nearest = key;
			nearestExp = exp;
		}
	}
	if (nearest !== undefined) {
		revoked.delete(nearest);
	}
}

/**
 * Remember `token` as revoked until `exp` (Unix seconds), the point where it
 * stops verifying on its own. When the set is still full after pruning, the
 * entry with the nearest `exp` is evicted, not the oldest inserted: whatever is
 * dropped is the revocation that would have lapsed soonest anyway, so the cap
 * costs the shortest possible window in which a revoked token verifies again.
 * Reaching the cap takes {@link MAX_REVOKED_TOKENS} sign-outs inside one
 * session lifetime.
 */
export async function revokeToken(token: string, exp: number): Promise<void> {
	const revoked = store();
	prune(revoked, Math.floor(Date.now() / 1000));
	if (revoked.size >= MAX_REVOKED_TOKENS) {
		evictNearestExpiry(revoked);
	}
	revoked.set(await fingerprint(token), exp);
}

/** Whether `token` was revoked and has not yet expired. */
export async function isRevoked(token: string): Promise<boolean> {
	const exp = store().get(await fingerprint(token));
	return exp !== undefined && exp > Math.floor(Date.now() / 1000);
}

/** Number of revocations held, for tests of the bound. */
export function revokedCount(): number {
	return store().size;
}

/** Forget every revocation. Tests only; nothing in the app calls it. */
export function clearRevocations(): void {
	store().clear();
}
