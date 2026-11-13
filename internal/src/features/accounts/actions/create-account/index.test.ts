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
const { createAccountAction } = await import(".");

const input = (over: Record<string, unknown> = {}) => ({
	name: "alice",
	displayName: "Alice A",
	addresses: ["alice@example.test"],
	password: PASSWORD,
	...over,
});

describe("createAccountAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, createAccountAction, (name) => input({ name }));

	it("is refused for a signed-in user who is not an admin, and never reaches the API", async () => {
		cookies.reset();
		await cookies.signIn("ana", "user");
		expect(await createAccountAction(input())).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	it("posts the account once and answers the stored name, never the password", async () => {
		stubFetchJson({ created: "alice" });

		const result = await createAccountAction(input());

		expect(result).toEqual({
			ok: true,
			data: { kind: "done", value: "alice" },
		});
		expect(JSON.stringify(result)).not.toContain(PASSWORD);
		const [call, ...rest] = sentRequests();
		expect(rest).toHaveLength(0);
		expect([call?.method, call?.url]).toEqual([
			"POST",
			"http://127.0.0.1:8025/api/v1/accounts",
		]);
		expect(JSON.parse(call?.body ?? "")).toEqual({
			name: "alice",
			addresses: ["alice@example.test"],
			password: PASSWORD,
			display_name: "Alice A",
		});
	});

	it("refuses every field outside its rule, and any extra field, before the API is called", async () => {
		stubFetchJson({ created: "alice" });
		const hostile: Array<Record<string, unknown>> = [
			{ password: "short" },
			{ password: "a".repeat(65) },
			{ password: `${PASSWORD}é` },
			{ password: `${PASSWORD}\n` },
			{ addresses: [] },
			{ addresses: "alice@example.test" },
			{ addresses: ["not an address"] },
			{ addresses: ["a@b\r\nBcc: x@evil.test"] },
			{ addresses: ["a@b‮"] },
			{ addresses: [`${"a".repeat(250)}@example.test`] },
			{ addresses: ["a@example.test", "a@example.test"] },
			{ addresses: Array.from({ length: 21 }, (_, i) => `a${i}@x.test`) },
			{ displayName: "a".repeat(129) },
			{ displayName: "Alice\r\nBcc: evil@x.test" },
			{ displayName: 7 },
			{ admin: true },
			{ display_name: "smuggled" },
		];

		for (const over of hostile) {
			expect([over, await createAccountAction(input(over))]).toEqual([
				over,
				{ ok: false, reason: "invalid" },
			]);
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports the server's refusal as a category, without its message", async () => {
		stubFetchJson(
			{
				error: {
					code: "invalid_input",
					message: `password ${PASSWORD} is in the breach list`,
				},
			},
			400,
		);
		const rejected = await createAccountAction(input());
		expect(rejected).toEqual({ ok: true, data: { kind: "rejected" } });
		expect(JSON.stringify(rejected)).not.toContain(PASSWORD);

		stubFetchJson(
			{ error: { code: "conflict", message: "tenant at max_accounts" } },
			409,
		);
		expect(await createAccountAction(input())).toEqual({
			ok: true,
			data: { kind: "conflict" },
		});
	});

	it("never writes the password to the log, on a refusal, a failure or a network error", async () => {
		const errors = spyOn(console, "error").mockImplementation(() => {});
		const logs = spyOn(console, "log").mockImplementation(() => {});
		const warns = spyOn(console, "warn").mockImplementation(() => {});
		try {
			stubFetchJson(
				{ error: { code: "internal", message: `leak ${PASSWORD}` } },
				500,
			);
			expect(await createAccountAction(input())).toEqual({
				ok: false,
				reason: "unavailable",
			});
			stubFetchReject();
			await createAccountAction(input());
			await createAccountAction(input({ name: ".." }));

			const written = [
				...errors.mock.calls,
				...logs.mock.calls,
				...warns.mock.calls,
			]
				.flat()
				.join("\n");
			expect(written).toContain("account create");
			expect(written).not.toContain(PASSWORD);
			expect(written).not.toContain("alice@example.test");
		} finally {
			errors.mockRestore();
			logs.mockRestore();
			warns.mockRestore();
		}
	});
});
