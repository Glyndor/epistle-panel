import { describe, expect, it } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const ADDRESS = "news.abcdefgh@example.org";
const cookies = mockRequestCookies();
const { removeMaskedAction } = await import(".");

describe("removeMaskedAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, removeMaskedAction, (name) => ({
		name,
		address: ADDRESS,
	}));

	it("removes the address with DELETE, percent-encoding it in the path", async () => {
		stubFetchJson({ removed: ADDRESS });

		expect(
			await removeMaskedAction({ name: "alice", address: ADDRESS }),
		).toEqual({
			ok: true,
			data: { kind: "done", value: true },
		});
		const [call] = sentRequests();
		expect([call?.method, call?.url]).toEqual([
			"DELETE",
			"http://127.0.0.1:8025/api/v1/accounts/alice/masked/news.abcdefgh%40example.org",
		]);
	});

	it("refuses an address that is not the minted shape, so nothing can climb out of the path", async () => {
		stubFetchJson({ removed: "x" });

		for (const address of [
			"../status",
			`${ADDRESS}/../../../queue`,
			"news.abcdefgh@example.org%2f..",
			`${ADDRESS}\r\nX: y`,
			"",
			5,
		]) {
			expect(
				await removeMaskedAction({ name: "alice", address }),
			).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("reports an unknown address (404) as notFound", async () => {
		stubFetchJson(
			{ error: { code: "not_found", message: "no such masked address" } },
			404,
		);

		expect(
			await removeMaskedAction({ name: "alice", address: ADDRESS }),
		).toEqual({
			ok: true,
			data: { kind: "notFound" },
		});
	});
});
