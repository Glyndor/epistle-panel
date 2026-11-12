import { describe, expect, it, spyOn } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const PASSWORD = "correct horse battery";
const cookies = mockRequestCookies();
const { setPasswordAction } = await import(".");

describe("setPasswordAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, setPasswordAction, (name) => ({
		name,
		password: PASSWORD,
	}));

	it("sends the new password to the API once and answers only that it worked", async () => {
		stubFetchJson({ updated: "alice" });

		const result = await setPasswordAction({
			name: "alice",
			password: PASSWORD,
		});

		expect(result).toEqual({
			ok: true,
			data: { kind: "done", value: true },
		});
		expect(JSON.stringify(result)).not.toContain(PASSWORD);
		const [call] = sentRequests();
		expect([call?.method, call?.url]).toEqual([
			"PUT",
			"http://127.0.0.1:8025/api/v1/accounts/alice/password",
		]);
		expect(JSON.parse(call?.body ?? "")).toEqual({ password: PASSWORD });
	});

	it("refuses a password outside the policy before the API is called", async () => {
		stubFetchJson({ updated: "alice" });

		for (const password of [
			"short",
			"a".repeat(65),
			`${PASSWORD}é`,
			`${PASSWORD}\n`,
			"",
		]) {
			expect(
				await setPasswordAction({ name: "alice", password }),
			).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports a rejection (a breached password) as a category, without the API's message", async () => {
		stubFetchJson(
			{
				error: {
					code: "invalid_input",
					message: `Password ${PASSWORD} is breached`,
				},
			},
			400,
		);

		const result = await setPasswordAction({
			name: "alice",
			password: PASSWORD,
		});

		expect(result).toEqual({ ok: true, data: { kind: "rejected" } });
		expect(JSON.stringify(result)).not.toContain(PASSWORD);
	});

	it("reports an account that is gone as notFound", async () => {
		stubFetchJson(
			{
				error: {
					code: "not_found",
					message: "no such dynamic account",
				},
			},
			404,
		);

		expect(
			await setPasswordAction({ name: "alice", password: PASSWORD }),
		).toEqual({
			ok: true,
			data: { kind: "notFound" },
		});
	});

	it("never writes the password to the log, on a refusal, a failure or a network error", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		const logs = spyOn(console, "log").mockImplementation(() => {});
		const warns = spyOn(console, "warn").mockImplementation(() => {});

		stubFetchJson(
			{ error: { code: "internal", message: `leak ${PASSWORD}` } },
			500,
		);
		expect(
			await setPasswordAction({ name: "alice", password: PASSWORD }),
		).toEqual({
			ok: false,
			reason: "unavailable",
		});
		stubFetchReject();
		await setPasswordAction({ name: "alice", password: PASSWORD });
		await setPasswordAction({ name: "alice", password: "short" });

		const written = [
			...errors.mock.calls,
			...logs.mock.calls,
			...warns.mock.calls,
		]
			.flat()
			.join("\n");
		expect(written).toContain(
			"account password failed: status=500 code=internal",
		);
		expect(written).not.toContain(PASSWORD);
		expect(written).not.toContain("short");
		errors.mockRestore();
		logs.mockRestore();
		warns.mockRestore();
	});
});
