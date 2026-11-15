import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { RefreshProvider } from "@/features/refresh/components/refresh-provider";
import { stubFetchJson } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { observedInterval } from "@/test/observed-interval";
import { testQueryClient, withQuery } from "@/test/query-wrapper";

const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();
const { StatusCards } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const body = { version: "9.9.9", domains: 1, accounts: 2, queue_size: 3 };

it("refreshes the counters at the interval of the person's pace", async () => {
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
					<StatusCards />
				</RefreshProvider>,
				client,
			),
		);
		await screen.findByText("9.9.9");
		expect([pace, observedInterval(client, ["status"])]).toEqual([
			pace,
			expected,
		]);
		cleanup();
	}
});
it("refreshes at the normal interval with no provider", async () => {
	stubFetchJson(body);
	const client = testQueryClient();
	render(withQuery(<StatusCards />, client));
	await screen.findByText("9.9.9");
	expect(observedInterval(client, ["status"])).toBe(15_000);
});
