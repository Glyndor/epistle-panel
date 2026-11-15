import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { RefreshProvider } from "@/features/refresh/components/refresh-provider";
import { stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withAdminRoutes } from "@/test/admin-routes";
import { observedInterval } from "@/test/observed-interval";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { QueueTable } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const body = {
	entries: [
		{
			id: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
			reverse_path: "zed@example.org",
			recipients: ["r1@example.net"],
		},
	],
};
const KEY = ["queue", "page", null];

it("refreshes the queue at the interval of the person's pace", async () => {
	for (const [pace, expected] of [
		["normal", 15_000],
		["slow", 30_000],
		["fast", 15_000],
	] as const) {
		stubFetchJson(body);
		const client = testQueryClient();
		render(
			withQuery(
				<RefreshProvider pace={pace}>
					{withAdminRoutes(<QueueTable cursor={undefined} />)}
				</RefreshProvider>,
				client,
			),
		);
		await screen.findByText("zed@example.org");
		expect([pace, observedInterval(client, KEY)]).toEqual([pace, expected]);
		cleanup();
	}
});
