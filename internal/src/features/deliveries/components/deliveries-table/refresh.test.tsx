import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { RefreshProvider } from "@/features/refresh/components/refresh-provider";
import { stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { observedInterval } from "@/test/observed-interval";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { DeliveriesTable } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const KEY = ["deliveries", "list", null, null, null];

it("refreshes the log at the interval of the person's pace", async () => {
	for (const [pace, expected] of [
		["normal", 30_000],
		["slow", 60_000],
		["fast", 15_000],
	] as const) {
		stubFetchJson({
			entries: [
				{
					time: 1_700_000_000,
					spool_id: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
					account: "alice",
					from: "a@example.org",
					recipient: "r@example.net",
					outcome: "delivered",
					remote: "mx.example.net",
					reply: "250 ok",
					attempt: 1,
					extra: {},
				},
			],
		});
		const client = testQueryClient();
		render(
			withQuery(
				<RefreshProvider pace={pace}>
					<DeliveriesTable filters={{}} />
				</RefreshProvider>,
				client,
			),
		);
		await screen.findByText("r@example.net");
		expect([pace, observedInterval(client, KEY)]).toEqual([pace, expected]);
		cleanup();
	}
});
