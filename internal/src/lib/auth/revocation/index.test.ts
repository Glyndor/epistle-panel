import { afterEach, describe, expect, it, setSystemTime } from "bun:test";

import {
	clearRevocations,
	isRevoked,
	MAX_REVOKED_TOKENS,
	revokedCount,
	revokeToken,
} from ".";

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

	it("stays bounded by evicting the oldest entry", async () => {
		for (let i = 0; i < MAX_REVOKED_TOKENS + 5; i++) {
			await revokeToken(`token-${i}`, inSeconds(3600));
		}

		expect(revokedCount()).toBe(MAX_REVOKED_TOKENS);
		expect(await isRevoked("token-0")).toBe(false);
		expect(await isRevoked(`token-${MAX_REVOKED_TOKENS + 4}`)).toBe(true);
	});
});
