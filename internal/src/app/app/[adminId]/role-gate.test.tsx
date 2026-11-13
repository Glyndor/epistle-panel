import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync } from "node:fs";

import { sentRequests, stubFetchJson } from "@/lib/api/test-support/fetch";
import {
	mockRequestCookies,
	NotFoundSignal,
} from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();

const { default: HomePage } = await import("./(status)/page");
const { default: DomainsPage } = await import("./domains/page");
const { default: AccountsPage } = await import("./accounts/(list)/page");
const { default: AccountPage } = await import("./accounts/[name]/page");
const { default: QueuePage } = await import("./queue/page");
const { default: SuppressionPage } = await import("./suppression/page");
const { default: DeliveriesPage } = await import("./deliveries/page");

const search = { searchParams: Promise.resolve({}) };

/** Each admin page by its file, relative to this folder, with a way to render it. */
const PAGES: Array<[string, string, () => Promise<unknown>]> = [
	["status", "(status)/page.tsx", () => HomePage()],
	["domains", "domains/page.tsx", () => DomainsPage()],
	["accounts", "accounts/(list)/page.tsx", () => AccountsPage()],
	[
		"account detail",
		"accounts/[name]/page.tsx",
		() => AccountPage({ params: Promise.resolve({ name: "alice" }) }),
	],
	["queue", "queue/page.tsx", () => QueuePage(search)],
	["suppression", "suppression/page.tsx", () => SuppressionPage(search)],
	["deliveries", "deliveries/page.tsx", () => DeliveriesPage(search)],
];

beforeEach(() => cookies.reset());

describe("every admin page checks the admin role itself", () => {
	it("covers every page file under the admin tree, so a new page cannot skip the check", () => {
		const onDisk = (
			readdirSync(import.meta.dir, { recursive: true }) as string[]
		)
			.map((file) => file.replaceAll("\\", "/"))
			.filter((file) => file === "page.tsx" || file.endsWith("/page.tsx"))
			.sort();

		expect(PAGES.map(([, file]) => file).sort()).toEqual(onDisk);
	});

	for (const [name, , render] of PAGES) {
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
