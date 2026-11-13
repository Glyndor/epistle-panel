import { describe, expect, it } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const cookies = mockRequestCookies();
const { getArchiveAction } = await import(".");

describe("getArchiveAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, getArchiveAction, (name) => ({ name }));

	it("returns the archived messages", async () => {
		stubFetchJson({
			entries: [{ id: ID, mailbox: "INBOX", deleted_at: 9 }],
		});

		expect(await getArchiveAction({ name: "alice" })).toEqual({
			ok: true,
			data: {
				state: "available",
				entries: [{ id: ID, mailbox: "INBOX", deletedAt: 9 }],
			},
		});
		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/accounts/alice/archive",
		);
	});

	it("answers a 404 as the archive being unavailable, a success and not an error", async () => {
		stubFetchJson(
			{
				error: {
					code: "not_found",
					message: "archive not available: x",
				},
			},
			404,
		);

		expect(await getArchiveAction({ name: "alice" })).toEqual({
			ok: true,
			data: { state: "unavailable" },
		});
	});
});
