import { afterEach, describe, expect, it, setSystemTime } from "bun:test";

import {
	createSession,
	SESSION_MAX_AGE_SECONDS,
	verifySession,
} from "./session";

afterEach(() => {
	setSystemTime();
});

describe("session tokens", () => {
	it("verifies a token it just minted", async () => {
		const token = await createSession("ops");
		expect(await verifySession(token)).toEqual({ sub: "ops" });
	});

	it("rejects a missing or malformed token", async () => {
		expect(await verifySession(undefined)).toBeNull();
		expect(await verifySession("")).toBeNull();
		expect(await verifySession("no-dot")).toBeNull();
		expect(await verifySession("a.b")).toBeNull();
	});

	it("rejects a tampered signature", async () => {
		const token = await createSession("ops");
		expect(await verifySession(`${token}tampered`)).toBeNull();
	});

	it("rejects a swapped payload under a stolen signature", async () => {
		const token = await createSession("ops");
		const signature = token.split(".")[1];
		const forgedPayload = btoa('{"sub":"evil","exp":9999999999}')
			.replaceAll("+", "-")
			.replaceAll("/", "_")
			.replaceAll("=", "");
		expect(await verifySession(`${forgedPayload}.${signature}`)).toBeNull();
	});

	it("rejects an expired token", async () => {
		const token = await createSession("ops");
		setSystemTime(
			new Date(Date.now() + (SESSION_MAX_AGE_SECONDS + 60) * 1000),
		);
		expect(await verifySession(token)).toBeNull();
	});
});
