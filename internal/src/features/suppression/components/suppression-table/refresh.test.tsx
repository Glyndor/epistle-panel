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
const { SuppressionTable } = await import(".");

beforeEach(async () => {
	cookies.reset();
	await cookies.signIn();
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const KEY = ["suppression", "page", null];

it("refreshes the list at the interval of the person's pace", async () => {
	for (const [pace, expected] of [
		["normal", 30_000],
		["slow", 60_000],
		["fast", 15_000],
	] as const) {
		stubFetchJson({ addresses: ["zed@example.org"] });
		const client = testQueryClient();
		render(
			withQuery(
				<RefreshProvider pace={pace}>
					{withAdminRoutes(<SuppressionTable after={undefined} />)}
				</RefreshProvider>,
				client,
			),
		);
		await screen.findByText("zed@example.org");
		expect([pace, observedInterval(client, KEY)]).toEqual([pace, expected]);
		cleanup();
	}
});
