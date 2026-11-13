import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup } from "@testing-library/react";

import { clearToasts } from "@/components/ui/toaster";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import type { mockRequestCookies } from "@/lib/auth/test-support/cookies";

import { settled } from "@/test/query-wrapper";

import { HOSTILE_NAMES } from "../hostile";

type Cookies = ReturnType<typeof mockRequestCookies>;
type Action = (input: unknown) => Promise<unknown>;

/**
 * What `fetch` is between cases: it never answers. A case that ends while its
 * action is still on the way to the API (the session check is asynchronous)
 * would otherwise reach the real network after the case is over.
 */
const idleFetch = (() =>
	new Promise<Response>(() => {})) as unknown as typeof fetch;

/** Reset the session jar and the stubbed `fetch` around each case of the calling file. */
export function useActionEnvironment(cookies: Cookies): void {
	beforeEach(async () => {
		process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
		process.env["EPISTLE_API_TOKEN"] = "test-token";
		cookies.reset();
		await cookies.signIn();
		// Nothing may be asked of the API by default; a case that expects a
		// call stubs its own answer.
		stubFetchJson({});
	});
	afterEach(async () => {
		// While the case's stub still answers: a request that outlived the case
		// would wait for ever on the idle `fetch` below.
		await settled();
		cleanup();
		clearToasts();
		globalThis.fetch = idleFetch;
	});
}

/**
 * The cases every account action has to pass: no session and a forged cookie
 * are answered `unauthenticated` with no request to the API, and every hostile
 * account name is `invalid` with no request either. `build` makes the action's
 * input for a given name.
 */
export function itGuardsItsInput(
	cookies: Cookies,
	action: Action,
	build: (name: string) => unknown,
): void {
	it("is refused without a session or with a forged cookie, and never reaches the API", async () => {
		cookies.reset();
		expect(await action(build("alice"))).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		cookies.jar.set("__Host-epistle_session", "forged.token");
		expect(await action(build("alice"))).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	it("checks the session before it looks at the input, so an anonymous caller learns nothing", async () => {
		cookies.reset();
		expect(await action({ not: "valid" })).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
	});

	it("refuses every hostile account name as invalid, before any request", async () => {
		for (const name of HOSTILE_NAMES) {
			expect([name, await action(build(name))]).toEqual([
				name,
				{ ok: false, reason: "invalid" },
			]);
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("refuses a missing name, an extra field and an input that is not an object", async () => {
		const valid = build("alice") as Record<string, unknown>;
		const { name: _name, ...withoutName } = valid;
		for (const input of [
			withoutName,
			{ ...valid, extra: 1 },
			null,
			"alice",
			[],
			undefined,
		]) {
			expect(await action(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});
}
