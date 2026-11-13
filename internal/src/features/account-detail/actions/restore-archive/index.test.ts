import { describe, expect, it } from "bun:test";
import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { HOSTILE_IDS } from "@/features/account-detail/test-support/hostile";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const cookies = mockRequestCookies();
const { restoreArchiveAction } = await import(".");

describe("restoreArchiveAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, restoreArchiveAction, (name) => ({
		name,
		id: ID,
	}));

	it("restores the message with POST and says where it went", async () => {
		stubFetchJson({ id: ID, restored_to: "INBOX" });

		expect(await restoreArchiveAction({ name: "alice", id: ID })).toEqual({
			ok: true,
			data: { kind: "done", value: { restoredTo: "INBOX" } },
		});
		const [call] = sentRequests();
		expect([call?.method, call?.url]).toEqual([
			"POST",
			`http://127.0.0.1:8025/api/v1/accounts/alice/archive/${ID}/restore`,
		]);
	});

	it("refuses an id that is not a UUID before the API is called", async () => {
		stubFetchJson({ id: ID, restored_to: "INBOX" });

		for (const id of [...HOSTILE_IDS, 5, null]) {
			expect(await restoreArchiveAction({ name: "alice", id })).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports a message that cannot be restored (the API answers 404) as notFound", async () => {
		stubFetchJson(
			{ error: { code: "not_found", message: "cannot restore: x" } },
			404,
		);

		expect(await restoreArchiveAction({ name: "alice", id: ID })).toEqual({
			ok: true,
			data: { kind: "notFound" },
		});
	});
});
