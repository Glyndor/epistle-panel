import { describe, expect, it } from "bun:test";

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

const cookies = mockRequestCookies();
const { getMailboxesAction } = await import(".");

describe("getMailboxesAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, getMailboxesAction, (name) => ({ name }));

	it("returns the mailbox rows of the account", async () => {
		stubFetchJson({
			mailboxes: ["INBOX"],
			tree: [{ id: "INBOX", name: "INBOX", parent_id: null }],
		});

		expect(await getMailboxesAction({ name: "alice" })).toEqual({
			ok: true,
			data: [{ id: "INBOX", name: "INBOX", depth: 0 }],
		});
		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/accounts/alice/mailboxes",
		);
	});

	it("reports an API failure as unavailable, logging only the operation and the error class", async () => {
		const { spyOn } = await import("bun:test");
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		expect(await getMailboxesAction({ name: "alice" })).toEqual({
			ok: false,
			reason: "unavailable",
		});
		expect(errors.mock.calls[0]?.[0]).toBe(
			"account mailboxes failed: error=TypeError",
		);
		errors.mockRestore();
	});
});
