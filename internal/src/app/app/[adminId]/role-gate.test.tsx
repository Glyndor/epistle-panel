import { beforeEach, describe, expect, it } from "bun:test";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	NotFoundSignal,
} from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();

const { default: HomePage } = await import("./page");
const { default: DomainsPage } = await import("./domains/page");
const { default: AccountsPage } = await import("./accounts/page");
const { default: AccountPage } = await import("./accounts/[name]/page");
const { default: QueuePage } = await import("./queue/page");
const { default: SuppressionPage } = await import("./suppression/page");
const { default: DeliveriesPage } = await import("./deliveries/page");

const search = { searchParams: Promise.resolve({}) };

const PAGES: Array<[string, () => Promise<unknown>]> = [
	["status", () => HomePage()],
	["domains", () => DomainsPage()],
	["accounts", () => AccountsPage()],
	[
		"account detail",
		() => AccountPage({ params: Promise.resolve({ name: "alice" }) }),
	],
	["queue", () => QueuePage(search)],
	["suppression", () => SuppressionPage(search)],
	["deliveries", () => DeliveriesPage(search)],
];

beforeEach(() => cookies.reset());

describe("every admin page checks the admin role itself", () => {
	for (const [name, render] of PAGES) {
		it(`${name}: a user session gets the 404 and the API is never asked`, async () => {
			await cookies.signIn("ana", "user");
			stubFetchJson({});

			expect(await render().catch((e) => e)).toBeInstanceOf(
				NotFoundSignal,
			);
			expect(sentRequests()).toHaveLength(0);
		});

		it(`${name}: an admin session with no admin id configured gets the 404`, async () => {
			await cookies.signIn("ops", "admin");
			stubFetchJson({});
			const saved = process.env["EPISTLE_PANEL_ADMIN_ID"];
			delete process.env["EPISTLE_PANEL_ADMIN_ID"];
			try {
				expect(await render().catch((e) => e)).toBeInstanceOf(
					NotFoundSignal,
				);
				expect(sentRequests()).toHaveLength(0);
			} finally {
				process.env["EPISTLE_PANEL_ADMIN_ID"] = saved;
			}
		});
	}
});
