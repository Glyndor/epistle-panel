import { describe, expect, it } from "bun:test";

import {
	itGuardsItsInput,
	useActionEnvironment,
} from "@/features/account-detail/test-support/action-checks";
import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { createMaskedAction } = await import(".");

describe("createMaskedAction", () => {
	useActionEnvironment(cookies);
	itGuardsItsInput(cookies, createMaskedAction, (name) => ({
		name,
		label: "News",
	}));

	it("sends the trimmed label and returns the address the server minted", async () => {
		stubFetchJson({ address: "news.abcdefgh@example.org" }, 201);

		const result = await createMaskedAction({
			name: "alice",
			label: "  News  ",
		});

		expect(result).toEqual({
			ok: true,
			data: {
				kind: "done",
				value: { address: "news.abcdefgh@example.org" },
			},
		});
		const [call] = sentRequests();
		expect([call?.method, call?.url]).toEqual([
			"POST",
			"http://127.0.0.1:8025/api/v1/accounts/alice/masked",
		]);
		expect(JSON.parse(call?.body ?? "")).toEqual({ label: "News" });
	});

	it("refuses a label with no letter or digit, a control character or a long one, before the API", async () => {
		stubFetchJson({ address: "x" });

		for (const label of ["---", "", "a\nb", "a".repeat(65), 5]) {
			expect(await createMaskedAction({ name: "alice", label })).toEqual({
				ok: false,
				reason: "invalid",
			});
		}
		expect(sentRequests()).toHaveLength(0);
	});

	it("tells a full account (409) from a refused label (400) and a missing account (404)", async () => {
		const outcomes = [];
		for (const status of [409, 400, 404]) {
			stubFetchJson({ error: { code: "c", message: "m" } }, status);
			outcomes.push(
				await createMaskedAction({ name: "alice", label: "News" }),
			);
		}
		expect(outcomes).toEqual([
			{ ok: true, data: { kind: "conflict" } },
			{ ok: true, data: { kind: "rejected" } },
			{ ok: true, data: { kind: "notFound" } },
		]);
	});
});
