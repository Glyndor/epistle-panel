import { describe, expect, it } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { getMaskedAction } = await import(".");

describe("getMaskedAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, getMaskedAction, (name) => ({ name }));

	it("returns the masked addresses of the account", async () => {
		stubFetchJson({
			addresses: [
				{
					address: "news.abcdefgh@example.org",
					label: "News",
					enabled: true,
					created_at: 1,
				},
			],
		});

		const result = await getMaskedAction({ name: "alice" });

		expect(result).toMatchObject({
			ok: true,
			data: [{ address: "news.abcdefgh@example.org", lastUsedAt: null }],
		});
		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/accounts/alice/masked",
		);
	});

	it("reports a 404 from the API as unavailable", async () => {
		const { spyOn } = await import("bun:test");
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchJson(
			{ error: { code: "not_found", message: "no such account" } },
			404,
		);

		expect(await getMaskedAction({ name: "alice" })).toEqual({
			ok: false,
			reason: "unavailable",
		});
		expect(errors.mock.calls[0]?.[0]).toBe(
			"account masked failed: status=404 code=not_found",
		);
		errors.mockRestore();
	});
});
