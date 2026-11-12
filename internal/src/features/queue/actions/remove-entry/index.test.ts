import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import { queueEntryIdSchema } from "@/features/queue/schemas/queue-input";
import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const ID = queueEntryIdSchema.parse("01890a5d-ac96-774b-b9aa-9be4c3bd6b0e");
const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { removeEntryAction } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("removeEntryAction", () => {
	it("deletes the entry for a signed-in admin and says which one went", async () => {
		await cookies.signIn();
		stubFetchJson({ removed: ID });

		expect(await removeEntryAction({ id: ID })).toEqual({
			ok: true,
			data: { removed: ID },
		});
		const [call] = sentRequests();
		expect(call?.method).toBe("DELETE");
		expect(call?.url).toEndWith(`/api/v1/queue/${ID}`);
	});

	it("refuses an id that is not a UUID, or extra fields, before the API is called", async () => {
		await cookies.signIn();
		stubFetchJson({ removed: ID });

		for (const input of [
			{ id: "../status" },
			{ id: ID, force: true },
			{},
			ID,
			null,
		]) {
			expect(await removeEntryAction(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("is refused without a session, with a tampered cookie, and never reaches the API", async () => {
		stubFetchJson({ removed: ID });
		expect(await removeEntryAction({ id: ID })).toEqual({
			ok: false,
			reason: "unauthenticated",
		});

		cookies.jar.set("__Host-epistle_admin_session", "forged.token");
		expect(await removeEntryAction({ id: ID })).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports an API failure as unavailable, with nothing of the error", async () => {
		await cookies.signIn();
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const result = await removeEntryAction({ id: ID });

		expect(result).toEqual({ ok: false, reason: "unavailable" });
		expect(errors.mock.calls[0]?.[0]).toBe(
			"queue remove failed: error=TypeError",
		);
		errors.mockRestore();
	});
});
