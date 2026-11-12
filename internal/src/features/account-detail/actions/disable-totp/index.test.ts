import { describe, expect, it } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { disableTotpAction } = await import(".");

describe("disableTotpAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, disableTotpAction, (name) => ({ name }));

	it("turns two-factor off with DELETE and says it worked", async () => {
		stubFetchJson({ updated: "alice" });

		expect(await disableTotpAction({ name: "alice" })).toEqual({
			ok: true,
			data: { kind: "done", value: true },
		});
		const [call] = sentRequests();
		expect([call?.method, call?.url]).toEqual([
			"DELETE",
			"http://127.0.0.1:8025/api/v1/accounts/alice/totp",
		]);
	});

	it("reports a missing account as notFound", async () => {
		stubFetchJson({ error: { code: "not_found", message: "x" } }, 404);

		expect(await disableTotpAction({ name: "alice" })).toEqual({
			ok: true,
			data: { kind: "notFound" },
		});
	});
});
