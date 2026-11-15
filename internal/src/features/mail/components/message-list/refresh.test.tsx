import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { forgetListMemory } from "@/features/mail/components/message-list/list-memory";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { RefreshProvider } from "@/features/refresh/components/refresh-provider";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { observedInterval } from "@/test/observed-interval";
import { settled, testQueryClient, withQuery } from "@/test/query-wrapper";
import { emailFixture, stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { MessageList } = await import(".");

const A = "00000000-0000-4000-8000-0000000000a1";
const view = {
	box: "INBOX",
	role: "inbox",
	page: 1,
	conditions: EMPTY_CONDITIONS,
} as const;

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(async () => {
	forgetListMemory();
	await settled();
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

it("refreshes the list at the interval of the person's pace", async () => {
	for (const [pace, expected] of [
		["normal", 30_000],
		["slow", 60_000],
		["fast", 15_000],
	] as const) {
		stubJmap({
			"Email/query": { ids: [A] },
			"Email/get": { list: [emailFixture({ id: A, subject: "First" })] },
		});
		const client = testQueryClient();
		render(
			withQuery(
				<RefreshProvider pace={pace}>
					<MessageList view={view} selectedId={undefined} />
				</RefreshProvider>,
				client,
			),
		);
		await screen.findByText("First");
		const interval = client
			.getQueryCache()
			.findAll({ queryKey: ["mail", "list"] })
			.map((query) => observedInterval(client, query.queryKey));
		expect([pace, interval]).toEqual([pace, [expected]]);
		cleanup();
	}
});
