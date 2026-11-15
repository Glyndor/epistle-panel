import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import {
	stubFetchJson,
	stubFetchReject,
	stubFetchResponse,
} from "@/lib/api/test-support/fetch";
import { SESSION, sessionResource } from "../../test-support/jmap-stub";

import { NO_CAPABILITIES, readSessionCapabilities } from ".";

const originalFetch = globalThis.fetch;

beforeEach(() => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
});

afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("readSessionCapabilities", () => {
	it("asks the server for its session, with the bearer and no cache", async () => {
		const calls: Array<[string, RequestInit | undefined]> = [];
		globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
			calls.push([String(url), init]);
			return new Response(JSON.stringify(sessionResource()), {
				status: 200,
				headers: { "content-type": "application/json" },
			});
		}) as unknown as typeof fetch;

		const capabilities = await readSessionCapabilities(SESSION);

		expect(capabilities).toEqual({
			maxSizeUpload: 26_214_400,
			maxSizeRequest: 10_000_000,
			maxObjectsInGet: 500,
			maxObjectsInSet: 500,
			maxSizeAttachmentsPerEmail: null,
		});
		expect(calls[0]?.[0]).toBe("http://127.0.0.1:8025/jmap/session");
		const headers = new Headers(calls[0]?.[1]?.headers);
		expect(headers.get("authorization")).toBe("Bearer test-bearer");
		expect(calls[0]?.[1]?.cache).toBe("no-store");
		expect(calls[0]?.[1]?.redirect).toBe("error");
	});

	it("reads the mail capability's own numbers", async () => {
		stubFetchJson({
			capabilities: {
				"urn:ietf:params:jmap:mail": {
					maxSizeAttachmentsPerEmail: 24_000_000,
				},
			},
		});

		const capabilities = await readSessionCapabilities(SESSION);

		expect(capabilities.maxSizeAttachmentsPerEmail).toBe(24_000_000);
		expect(capabilities.maxSizeUpload).toBeNull();
	});

	it("publishes nothing when the session has no capability, or none of the ones it reads", async () => {
		for (const body of [
			{},
			{ capabilities: {} },
			{ capabilities: { "urn:ietf:params:jmap:other": {} } },
			{ capabilities: { "urn:ietf:params:jmap:core": 5 } },
		]) {
			stubFetchJson(body);
			expect([body, await readSessionCapabilities(SESSION)]).toEqual([
				body,
				NO_CAPABILITIES,
			]);
		}
	});

	it("believes a number that is missing, zero, negative, not a number, past the ceiling or of another type as none", async () => {
		for (const value of [
			0,
			-1,
			Number.NaN,
			Number.POSITIVE_INFINITY,
			1_073_741_825,
			"26214400",
			null,
			1.5,
			[],
			{},
		]) {
			stubFetchJson({
				capabilities: {
					"urn:ietf:params:jmap:core": { maxSizeUpload: value },
				},
			});

			expect([value, await readSessionCapabilities(SESSION)]).toEqual([
				value,
				NO_CAPABILITIES,
			]);
		}
	});

	it("reads each number on its own: one that cannot be used leaves the others", async () => {
		stubFetchJson({
			capabilities: {
				"urn:ietf:params:jmap:core": {
					maxSizeUpload: "26214400",
					maxSizeRequest: 10_000_000,
					maxObjectsInGet: 500,
				},
			},
		});

		expect(await readSessionCapabilities(SESSION)).toEqual({
			maxSizeUpload: null,
			maxSizeRequest: 10_000_000,
			maxObjectsInGet: 500,
			maxObjectsInSet: null,
			maxSizeAttachmentsPerEmail: null,
		});
	});

	it("publishes nothing when the server refuses the session or cannot be asked", async () => {
		stubFetchResponse(new Response("not found", { status: 404 }));
		expect(await readSessionCapabilities(SESSION)).toEqual(NO_CAPABILITIES);

		stubFetchResponse(new Response("{}", { status: 500 }));
		expect(await readSessionCapabilities(SESSION)).toEqual(NO_CAPABILITIES);

		stubFetchReject();
		expect(await readSessionCapabilities(SESSION)).toEqual(NO_CAPABILITIES);
	});

	it("publishes nothing when the answer is not a session at all", async () => {
		for (const body of [null, [], "x", 5]) {
			stubFetchJson(body);
			expect(await readSessionCapabilities(SESSION)).toEqual(
				NO_CAPABILITIES,
			);
		}
	});
});
