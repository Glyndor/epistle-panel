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
import { firstPaint, resolveServerTree } from "@/test/server-tree";
import { stepText } from "@/test/trail-steps";

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
const { default: AccountTrail } = await import("./@trail/accounts/[name]/page");

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

/** The trail of each page, as its steps and the addresses of its links. */
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

/** The trail of each page: a page of its own, in the `trail` slot of the layout. */
const trails: Record<keyof typeof loadings, () => Promise<ReactNode>> = {
	status: (await import("./@trail/page")).default,
	queue: (await import("./@trail/queue/page")).default,
	accounts: (await import("./@trail/accounts/page")).default,
	domains: (await import("./@trail/domains/page")).default,
	suppression: (await import("./@trail/suppression/page")).default,
	deliveries: (await import("./@trail/deliveries/page")).default,
	account: () => AccountTrail({ params: Promise.resolve({ name: "alice" }) }),
};

/** The steps of the trail on screen, the addresses of its links and its current page. */
function trailOnScreen() {
	const nav = screen.getByRole("navigation", { name: "breadcrumb" });
	return {
		steps: within(nav).getAllByRole("listitem").map(stepText),
		links: within(nav)
			.getAllByRole("link")
			.map((link) => link.getAttribute("href")),
		current: [...nav.querySelectorAll('[aria-current="page"]')].map(
			(node) => node.textContent,
		),
	};
}

describe("the header draws the trail to every admin page before the page's data", () => {
	for (const [name, page] of cases) {
		const [steps, links] = TRAILS[name];
		const hrefs = links.map((path) => `/app/${TEST_ADMIN_ID}${path}`);

		it(`${name}: the trail is in the first paint, and the page's own data is not asked for it`, async () => {
			render(firstPaint(await trails[name]()));
			const trail = trailOnScreen();

			expect(trail.links).toEqual(hrefs);
			expect(paths()).toEqual([]);
			if (name === "account") {
				// The trail is not told yet whether the name is an account:
				// a bar holds its place and nothing is the current page.
				expect(trail.steps).toEqual(["administration", "accounts", ""]);
				expect(trail.current).toEqual([]);
			} else {
				expect(trail.steps).toEqual(steps);
				expect(trail.current).toEqual([steps.at(-1) as string]);
			}
		});

		it(`${name}: the page and its loading state draw no trail of their own`, async () => {
			const first = render(withAdminArea(firstPaint(await page())));
			expect(
				screen.queryByRole("navigation", { name: "breadcrumb" }),
			).toBeNull();
			first.unmount();

			render(withAdminArea(await loadings[name]()));
			expect(
				screen.queryByRole("navigation", { name: "breadcrumb" }),
			).toBeNull();
		});
	}

	it("an address of the area with no trail of its own draws none", async () => {
		const { default: NoTrail } = await import("./@trail/default");

		expect(NoTrail()).toBeNull();
	});

	it("account: once the accounts list answers, the account is the current page", async () => {
		render(await resolveServerTree(await trails.account()));

		expect(trailOnScreen()).toEqual({
			steps: ["administration", "accounts", "alice"],
			links: [`/app/${TEST_ADMIN_ID}`, `/app/${TEST_ADMIN_ID}/accounts`],
			current: ["alice"],
		});
		expect(paths()).toEqual(["/api/v1/accounts"]);
	});

	it("account: a name that is no account is never shown as a page, and one that could not be a name asks the API nothing", async () => {
		for (const [name, asked] of [
			["bob", ["/api/v1/accounts"]],
			["..%2fqueue", []],
			["%3Cscript%3E", []],
			["Admin", []],
		] as const) {
			const before = paths().length;
			render(
				await resolveServerTree(
					await AccountTrail({ params: Promise.resolve({ name }) }),
				),
			);

			expect([name, trailOnScreen()]).toEqual([
				name,
				{
					steps: ["administration", "accounts"],
					links: [
						`/app/${TEST_ADMIN_ID}`,
						`/app/${TEST_ADMIN_ID}/accounts`,
					],
					current: [],
				},
			]);
			expect([name, paths().slice(before)]).toEqual([name, [...asked]]);
			cleanup();
		}
	});
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
		// The trail of the header is a page too, in the layout's `trail` slot
		// (`@trail`). It is drawn by the layout, outside the boundary a
		// `loading.tsx` makes, so it has no loading state and is left out here.
		const pages = files.filter(
			(file) => file.endsWith("page.tsx") && !file.startsWith("@"),
		);
		expect(
			files.filter((file) => file.endsWith("loading.tsx")),
		).not.toContainEqual(expect.stringMatching(/^@/));
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
