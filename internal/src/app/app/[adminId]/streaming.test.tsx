import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";

import { stubRoutes } from "@/features/account-detail/test-support/stub-routes";
import { sentRequests } from "@/lib/api/test-support/fetch";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";
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
	["status", () => HomePage(none), "status-skeleton", []],
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

/** The trail each page draws, as its steps and the addresses of its links. */
const TRAILS: Record<keyof typeof loadings, [string[], string[]]> = {
	status: [["administration", "status"], [""]],
	queue: [["administration", "queue"], [""]],
	accounts: [["administration", "accounts"], [""]],
	domains: [["administration", "domains"], [""]],
	suppression: [["administration", "suppression"], [""]],
	deliveries: [["administration", "deliveries"], [""]],
	account: [
		["administration", "accounts", "alice"],
		["", "/accounts"],
	],
};

/** The steps of the trail on screen, the addresses of its links and its current page. */
function trailOnScreen() {
	const nav = screen.getByRole("navigation", { name: "breadcrumb" });
	return {
		steps: within(nav)
			.getAllByRole("listitem")
			.map((item) => item.textContent),
		links: within(nav)
			.getAllByRole("link")
			.map((link) => link.getAttribute("href")),
		current: [...nav.querySelectorAll('[aria-current="page"]')].map(
			(node) => node.textContent,
		),
	};
}

describe("every admin page draws the trail to itself before its data", () => {
	for (const [name, page] of cases) {
		const [steps, links] = TRAILS[name];
		const hrefs = links.map((path) => `/app/${TEST_ADMIN_ID}${path}`);

		it(`${name}: the trail is in the first paint, the last step the current page`, async () => {
			render(withAdminArea(firstPaint(await page())));

			expect(trailOnScreen()).toEqual({
				steps,
				links: hrefs,
				current: [steps.at(-1) as string],
			});
		});

		it(`${name}: loading.tsx draws the same trail`, async () => {
			render(withAdminArea(await loadings[name]()));
			const trail = trailOnScreen();

			expect(trail.links).toEqual(hrefs);
			if (name === "account") {
				// The loading state is not told the account: a bar holds
				// the place of its name and nothing is the current page.
				expect(trail.steps).toEqual(["administration", "accounts", ""]);
				expect(trail.current).toEqual([]);
			} else {
				expect(trail.steps).toEqual(steps);
				expect(trail.current).toEqual([steps.at(-1) as string]);
			}
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

describe("a loading state belongs to one page", () => {
	it("none sits beside the admin layout, where it would be every page's first paint", () => {
		// A `loading.tsx` wraps the pages of the folders below it too. Beside
		// the layout it was the status page's heading and trail, painted
		// first on a load of any other admin page.
		expect(existsSync(join(import.meta.dir, "layout.tsx"))).toBe(true);
		expect(existsSync(join(import.meta.dir, "loading.tsx"))).toBe(false);
	});

	it("every page has one in its own folder, and no folder with one holds another page below", () => {
		const files = (
			readdirSync(import.meta.dir, { recursive: true }) as string[]
		).map((file) => file.replaceAll("\\", "/"));
		const pages = files.filter((file) => file.endsWith("page.tsx"));
		const loadingFolders = files
			.filter((file) => file.endsWith("loading.tsx"))
			.map((file) => dirname(file));

		expect(pages.length).toBe(Object.keys(loadings).length);
		for (const page of pages) {
			const folder = dirname(page);
			expect([page, loadingFolders.includes(folder)]).toEqual([
				page,
				true,
			]);
			// The nearest loading state above a page is its own.
			const above = loadingFolders.filter(
				(candidate) =>
					candidate !== folder && folder.startsWith(`${candidate}/`),
			);
			expect([page, above]).toEqual([page, []]);
		}
	});
});
