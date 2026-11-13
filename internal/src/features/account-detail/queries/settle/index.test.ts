import { afterEach, describe, expect, it } from "bun:test";

import { EpistleApiError } from "@/lib/api/client";
import { request } from "@/lib/api/request";
import { updatedSchema } from "@/lib/api/schemas";
import { stubFetchJson, stubFetchReject } from "@/lib/api/test-support/fetch";

import { settle } from ".";

const originalFetch = globalThis.fetch;
afterEach(() => {
	globalThis.fetch = originalFetch;
});

const call = () => request("/api/v1/x", updatedSchema);
const refusal = (status: number) =>
	stubFetchJson(
		{ error: { code: "c", message: "echoes secret-input" } },
		status,
	);

describe("settle", () => {
	it("returns the value of a call that worked", async () => {
		stubFetchJson({ updated: "alice" });
		expect(await settle(call)).toEqual({
			kind: "done",
			value: { updated: "alice" },
		});
	});

	it("names the three refusals a person can act on, and drops the API's message", async () => {
		for (const [status, kind] of [
			[400, "rejected"],
			[404, "notFound"],
			[409, "conflict"],
		] as const) {
			refusal(status);
			const outcome = await settle(call);
			expect(outcome).toEqual({ kind });
			expect(JSON.stringify(outcome)).not.toContain("secret-input");
		}
	});

	it("rethrows every other status so the action logs it and reports unavailable", async () => {
		for (const status of [401, 403, 415, 422, 429, 500, 507]) {
			refusal(status);
			await expect(settle(call)).rejects.toBeInstanceOf(EpistleApiError);
		}
	});

	it("rethrows a network failure and a body that does not parse", async () => {
		stubFetchReject();
		await expect(settle(call)).rejects.toThrow("network error");
		stubFetchJson({ unexpected: true });
		await expect(settle(call)).rejects.toThrow();
	});
});
