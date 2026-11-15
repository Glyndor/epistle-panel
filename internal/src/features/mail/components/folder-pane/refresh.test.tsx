import { afterEach, beforeEach, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { RefreshProvider } from "@/features/refresh/components/refresh-provider";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { clearSecretCache } from "@/lib/config/secret";
import { observedInterval } from "@/test/observed-interval";
import { settled, testQueryClient, withQuery } from "@/test/query-wrapper";
import { stubJmap } from "../../test-support/jmap-stub";

const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
const cookies = mockRequestCookies();
const { FolderPane } = await import(".");

beforeEach(async () => {
	clearSecretCache();
	cookies.reset();
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "t";
	await cookies.signIn("admin");
});
afterEach(async () => {
	await settled();
	process.env = { ...savedEnv };
	cleanup();
	globalThis.fetch = originalFetch;
});

it("refreshes the folders at the interval of the person's pace", async () => {
	for (const [pace, expected] of [
		["normal", 30_000],
		["slow", 60_000],
		["fast", 15_000],
	] as const) {
		stubJmap({
			"Mailbox/get": {
				list: [
					{
						id: "INBOX",
						name: "INBOX",
						role: "inbox",
						totalEmails: 2,
						unreadEmails: 1,
					},
				],
			},
		});
		const client = testQueryClient();
		render(
			withQuery(
				<RefreshProvider pace={pace}>
					<SidebarProvider>
						<FolderPane boxes={undefined} />
					</SidebarProvider>
				</RefreshProvider>,
				client,
			),
		);
		await screen.findByRole("navigation", { name: "folders" });
		expect([pace, observedInterval(client, ["mail", "mailboxes"])]).toEqual(
			[pace, expected],
		);
		cleanup();
	}
});
