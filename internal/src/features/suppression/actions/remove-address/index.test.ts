import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";

import {
	sentRequests,
	stubFetchJson,
	stubFetchReject,
} from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const ADDRESS = "bob@example.net";
const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { removeAddressAction } = await import(".");

beforeEach(() => cookies.reset());
afterEach(() => {
	globalThis.fetch = originalFetch;
});

describe("removeAddressAction", () => {
	it("deletes the address for a signed-in admin and says which one went", async () => {
		await cookies.signIn();
		stubFetchJson({ removed: ADDRESS });

		expect(await removeAddressAction({ address: ADDRESS })).toEqual({
			ok: true,
			data: { removed: ADDRESS },
		});
		const [call] = sentRequests();
		expect(call?.method).toBe("DELETE");
		expect(call?.url).toEndWith("/api/v1/suppression/bob%40example.net");
	});

	it("refuses hostile input before the API is called", async () => {
		await cookies.signIn();
		stubFetchJson({ removed: ADDRESS });

		for (const input of [
			{ address: "../status" },
			{ address: "..%2fstatus" },
			{ address: "a@b.org\nDELETE" },
			{ address: "a@b.org\r\n" },
			{ address: "a‮@b.org" },
			{ address: `${"a".repeat(255)}@b.org` },
			{ address: "" },
			{ address: ADDRESS, account: "other@x.org" },
			{},
			ADDRESS,
			null,
		]) {
			expect(await removeAddressAction(input)).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("sends a path-like local part as one encoded segment", async () => {
		await cookies.signIn();
		stubFetchJson({ removed: "a/../b@x.org" });

		const result = await removeAddressAction({ address: "a/../b@x.org" });

		expect(result.ok).toBe(true);
		expect(sentRequests()[0]?.url).toEndWith(
			"/api/v1/suppression/a%2F..%2Fb%40x.org",
		);
	});

	it("is refused without a session, with a tampered cookie, and never reaches the API", async () => {
		stubFetchJson({ removed: ADDRESS });
		expect(await removeAddressAction({ address: ADDRESS })).toEqual({
			ok: false,
			reason: "unauthenticated",
		});

		cookies.jar.set("__Host-epistle_admin_session", "forged.token");
		expect(await removeAddressAction({ address: ADDRESS })).toEqual({
			ok: false,
			reason: "unauthenticated",
		});
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports an API failure as unavailable, with nothing of the error", async () => {
		await cookies.signIn();
		const errors = spyOn(console, "error").mockImplementation(() => {});
		stubFetchReject();

		const result = await removeAddressAction({ address: ADDRESS });

		expect(result).toEqual({ ok: false, reason: "unavailable" });
		expect(errors.mock.calls[0]?.[0]).toBe(
			"suppression remove failed: error=TypeError",
		);
		errors.mockRestore();
	});
});
