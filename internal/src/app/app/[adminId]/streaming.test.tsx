import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import { sentRequests } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { withAdminArea } from "@/test/admin-routes";
import { firstPaint } from "@/test/server-tree";

/**
 * What every admin page sends before the API answers: its heading and the
 * skeleton of the view that is coming, and no request for that view's data
 * yet. The account page is the one exception, on purpose: it reads the
 * accounts list before it sends anything, so an account that is not there is
 * a 404 and costs no per-account call.
 */
const originalFetch = globalThis.fetch;
const cookies = mockRequestCookies();

const { default: HomePage } = await import("./(status)/page");
const { default: QueuePage } = await import("./queue/page");
const { default: AccountsPage } = await import("./accounts/(list)/page");
const { default: AccountDetailPage } = await import("./accounts/[name]/page");
const { default: DomainsPage } = await import("./domains/page");
const { default: SuppressionPage } = await import("./suppression/page");
const { default: DeliveriesPage } = await import("./deliveries/page");

const loadings = {
	status: (await import("./(status)/loading")).default,
	queue: (await import("./queue/loading")).default,
	accounts: (await import("./accounts/(list)/loading")).default,
	domains: (await import("./domains/loading")).default,
	suppression: (await import("./suppression/loading")).default,
	deliveries: (await import("./deliveries/loading")).default,
	account: (await import("./accounts/[name]/loading")).default,
} as const;

const none = { searchParams: Promise.resolve({}) };
const paths = () => sentRequests().map((r) => new URL(r.url).pathname);

beforeEach(async () => {
	process.env["EPISTLE_API_URL"] = "http://127.0.0.1:8025";
	process.env["EPISTLE_API_TOKEN"] = "test-token";
	cookies.reset();
	await cookies.signIn();
	stubRoutes([
		[
			"GET",
			/\/accounts$/,
			{
				body: {
					accounts: [
						{
							name: "alice",
							display_name: null,
							addresses: ["alice@example.org"],
							dynamic: true,
						},
					],
				},
			},
		],
	]);
});
afterEach(() => {
	cleanup();
	globalThis.fetch = originalFetch;
});

const cases: [
	keyof typeof loadings,
	() => Promise<ReactNode>,
	string,
	string[],
][] = [
	["status", () => HomePage(), "status-skeleton", []],
	["queue", () => QueuePage(none), "table-skeleton", []],
	["accounts", () => AccountsPage(), "table-skeleton", []],
	["domains", () => DomainsPage(), "table-skeleton", []],
	["suppression", () => SuppressionPage(none), "table-skeleton", []],
	["deliveries", () => DeliveriesPage(none), "table-skeleton", []],
	[
		"account",
		() => AccountDetailPage({ params: Promise.resolve({ name: "alice" }) }),
		"account-skeleton",
		["/api/v1/accounts"],
	],
];

describe("admin pages stream their data", () => {
	for (const [name, page, skeleton, before] of cases) {
		it(`${name}: heading and skeleton first, no data request yet`, async () => {
			const tree = await page();

			expect(paths()).toEqual(before);
			render(withAdminArea(firstPaint(tree)));
			expect(
				screen.getByRole("heading", { level: 1 }),
			).toBeInTheDocument();
			expect(screen.getByTestId(skeleton)).toHaveAttribute(
				"aria-busy",
				"true",
			);
			expect(screen.getByRole("status")).toHaveTextContent("loading");
		});
	}
});

describe("each route's loading state is the page's first paint", () => {
	for (const [name, page, skeleton] of cases) {
		it(`${name}: loading.tsx draws the same skeleton as the page`, async () => {
			const loading = render(withAdminArea(await loadings[name]()));
			const fromLoading = loading.getByTestId(skeleton).outerHTML;
			const loadingHtml = loading.container.innerHTML;
			loading.unmount();

			const first = render(withAdminArea(firstPaint(await page())));
			expect(first.getByTestId(skeleton).outerHTML).toBe(fromLoading);
			if (name !== "account") {
				// Heading, description and filter form too: the whole frame.
				expect(first.container.innerHTML).toBe(loadingHtml);
			}
		});
	}
});
