import { describe, expect, it } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { deleteAccountAction } = await import(".");

const removed = {
	removed: "alice",
	mailbox_files: 3,
	masked_addresses: 0,
	app_passwords: 0,
	suppressed_addresses: 0,
	correspondent_addresses: 0,
	queued_messages_discarded: 0,
	queued_messages_left: 2,
	bayes_tokens_removed: 0,
};

describe("deleteAccountAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, deleteAccountAction, (name) => ({
		name,
		queue: "drain",
	}));

	it("is refused for a signed-in user who is not an admin, and never reaches the API", async () => {
		cookies.reset();
		await cookies.signIn("ana", "user");
		expect(
			await deleteAccountAction({ name: "alice", queue: "drain" }),
		).toEqual({ ok: false, reason: "unauthenticated" });
		expect(sentRequests()).toHaveLength(0);
	});

	it("deletes once with the queue choice and answers what was left and dropped", async () => {
		stubFetchJson(removed);

		expect(
			await deleteAccountAction({ name: "alice", queue: "drain" }),
		).toEqual({
			ok: true,
			data: { kind: "done", value: { left: 2, discarded: 0 } },
		});
		const [call, ...rest] = sentRequests();
		expect(rest).toHaveLength(0);
		expect([call?.method, call?.url]).toEqual([
			"DELETE",
			"http://127.0.0.1:8025/api/v1/accounts/alice?queue=drain",
		]);

		stubFetchJson({
			...removed,
			queued_messages_left: 0,
			queued_messages_discarded: 4,
		});
		expect(
			await deleteAccountAction({ name: "alice", queue: "discard" }),
		).toEqual({
			ok: true,
			data: { kind: "done", value: { left: 0, discarded: 4 } },
		});
	});

	it("needs the queue choice: a missing, unknown or smuggled one is invalid before any request", async () => {
		stubFetchJson(removed);
		for (const input of [
			{ name: "alice" },
			{ name: "alice", queue: "" },
			{ name: "alice", queue: "DROP" },
			{ name: "alice", queue: "discard&force=1" },
			{ name: "alice", queue: ["drain"] },
			{ name: "alice", queue: "drain", force: true },
		]) {
			expect([input, await deleteAccountAction(input)]).toEqual([
				input,
				{ ok: false, reason: "invalid" },
			]);
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports an account the API does not manage, or one already gone, as notFound", async () => {
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
			await deleteAccountAction({ name: "alice", queue: "drain" }),
		).toEqual({ ok: true, data: { kind: "notFound" } });
	});
});
