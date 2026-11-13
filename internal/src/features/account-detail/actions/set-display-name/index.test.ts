import { describe, expect, it } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { setDisplayNameAction } = await import(".");

describe("setDisplayNameAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, setDisplayNameAction, (name) => ({
		name,
		displayName: "Alice",
	}));

	it("sends the trimmed name and returns what the server stored", async () => {
		stubFetchJson({ display_name: "Alice A." });

		const result = await setDisplayNameAction({
			name: "alice",
			displayName: "  Alice A.  ",
		});

		expect(result).toEqual({
			ok: true,
			data: { kind: "done", value: { displayName: "Alice A." } },
		});
		const [call] = sentRequests();
		expect([call?.method, call?.url]).toEqual([
			"PUT",
			"http://127.0.0.1:8025/api/v1/accounts/alice/display_name",
		]);
		expect(JSON.parse(call?.body ?? "")).toEqual({
			display_name: "Alice A.",
		});
	});

	it("clears the name with an empty value and reports null", async () => {
		stubFetchJson({ display_name: null });

		expect(
			await setDisplayNameAction({ name: "alice", displayName: "" }),
		).toEqual({
			ok: true,
			data: { kind: "done", value: { displayName: null } },
		});
	});

	it("refuses a control character or an overlong name before the API is called", async () => {
		stubFetchJson({ display_name: null });

		for (const displayName of [
			"a\nb",
			"a\r\nBcc: x@y",
			"a".repeat(129),
			5,
			null,
		]) {
			expect(
				await setDisplayNameAction({ name: "alice", displayName }),
			).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports a refusal and a missing account as categories", async () => {
		stubFetchJson({ error: { code: "invalid_input", message: "x" } }, 400);
		expect(
			await setDisplayNameAction({ name: "alice", displayName: "A" }),
		).toEqual({
			ok: true,
			data: { kind: "rejected" },
		});
		stubFetchJson({ error: { code: "not_found", message: "x" } }, 404);
		expect(
			await setDisplayNameAction({ name: "alice", displayName: "A" }),
		).toEqual({
			ok: true,
			data: { kind: "notFound" },
		});
	});
});
