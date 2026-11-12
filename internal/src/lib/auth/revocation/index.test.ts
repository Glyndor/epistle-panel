import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	setSystemTime,
} from "bun:test";

import {
	clearRevocations,
	isRevoked,
	MAX_REVOKED_TOKENS,
	revokedCount,
	revokeToken,
} from ".";

// The store is process-global, so a sign-out test in another file leaves its
// revocation behind. Start every case from an empty set: the bound and the
// count assertions below are exact.
beforeEach(clearRevocations);
afterEach(() => {
	clearRevocations();
	setSystemTime();
});

const inSeconds = (seconds: number) => Math.floor(Date.now() / 1000) + seconds;

describe("revocation set", () => {
	it("reports a revoked token and not an unknown one", async () => {
		await revokeToken("token-a", inSeconds(60));

		expect(await isRevoked("token-a")).toBe(true);
		expect(await isRevoked("token-b")).toBe(false);
	});

	it("forgets a token once it would have expired anyway", async () => {
		await revokeToken("token-a", inSeconds(60));
		setSystemTime(new Date(Date.now() + 61_000));

		expect(await isRevoked("token-a")).toBe(false);
	});

	it("prunes expired entries when a new one is added", async () => {
		await revokeToken("old", inSeconds(10));
		setSystemTime(new Date(Date.now() + 11_000));
		await revokeToken("new", inSeconds(60));

		expect(revokedCount()).toBe(1);
	});

	it("stays bounded by evicting the entry that expires first", async () => {
		for (let i = 0; i < MAX_REVOKED_TOKENS + 5; i++) {
			await revokeToken(`token-${i}`, inSeconds(3600 + i));
		}

		expect(revokedCount()).toBe(MAX_REVOKED_TOKENS);
		expect(await isRevoked("token-0")).toBe(false);
		expect(await isRevoked("token-4")).toBe(false);
		expect(await isRevoked("token-5")).toBe(true);
		expect(await isRevoked(`token-${MAX_REVOKED_TOKENS + 4}`)).toBe(true);
	});

	it("keeps the revocation with the furthest expiry when earlier ones fill the cap", async () => {
		// Inserted first and expiring last: insertion-order eviction would drop it.
		await revokeToken("long-lived", inSeconds(8 * 3600));
		for (let i = 0; i < MAX_REVOKED_TOKENS + 5; i++) {
			await revokeToken(`short-${i}`, inSeconds(60 + i));
		}

		expect(revokedCount()).toBe(MAX_REVOKED_TOKENS);
		expect(await isRevoked("long-lived")).toBe(true);
	});
});
