import { describe, expect, it, spyOn } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const SECRET = "JBSWY3DPEHPK3PXP";
const cookies = mockRequestCookies();
const { enrollTotpAction } = await import(".");

describe("enrollTotpAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, enrollTotpAction, (name) => ({ name }));

	it("returns the new secret and its URI, and asks the API with POST and no body", async () => {
		stubFetchJson({
			secret: SECRET,
			otpauth_uri: `otpauth://totp/x:alice?secret=${SECRET}`,
		});

		const result = await enrollTotpAction({ name: "alice" });

		expect(result).toEqual({
			ok: true,
			data: {
				kind: "done",
				value: {
					secret: SECRET,
					otpauthUri: `otpauth://totp/x:alice?secret=${SECRET}`,
				},
			},
		});
		const [call] = sentRequests();
		expect([call?.method, call?.url, call?.body]).toEqual([
			"POST",
			"http://127.0.0.1:8025/api/v1/accounts/alice/totp",
			undefined,
		]);
	});

	it("never writes the secret to the log, on success or when the API's error quotes it", async () => {
		const spies = (["log", "error", "warn", "info", "debug"] as const).map(
			(m) => spyOn(console, m).mockImplementation(() => {}),
		);

		stubFetchJson({
			secret: SECRET,
			otpauth_uri: `otpauth://totp/x:alice?secret=${SECRET}`,
		});
		await enrollTotpAction({ name: "alice" });
		stubFetchJson(
			{ error: { code: "internal", message: `oops ${SECRET}` } },
			500,
		);
		expect(await enrollTotpAction({ name: "alice" })).toEqual({
			ok: false,
			reason: "unavailable",
		});

		const written = spies
			.flatMap((spy) => spy.mock.calls)
			.flat()
			.join("\n");
		expect(written).toContain(
			"account totp enroll failed: status=500 code=internal",
		);
		expect(written).not.toContain(SECRET);
		for (const spy of spies) {
			spy.mockRestore();
		}
	});

	it("reports an account that cannot be enrolled (a 404) as notFound", async () => {
		stubFetchJson(
			{
				error: {
					code: "not_found",
					message: "no such dynamic account",
				},
			},
			404,
		);

		expect(await enrollTotpAction({ name: "alice" })).toEqual({
			ok: true,
			data: { kind: "notFound" },
		});
	});
});
