import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { TEST_ROUTES } from "@/features/navigation/test-support/admin-nav";
import { resolveServerTree } from "@/test/server-tree";

import { AppShell } from ".";

afterEach(cleanup);

type ShellProps = Parameters<typeof AppShell>[0];

async function renderShell(props: Partial<ShellProps> = {}) {
	return render(
		await resolveServerTree(
			AppShell({
				navigation: (
					<nav aria-label="pages">
						<a href="/somewhere">somewhere</a>
					</nav>
				),
				homeHref: TEST_ROUTES.home,
				subtitle: "Admin panel",
				sheet: { title: "Navigation", description: "Pages." },
				user: { name: "ops", role: "admin" },
				adminHref: TEST_ROUTES.home,
				defaultOpen: true,
				children: <p>page</p>,
				...props,
			}),
		),
	);
}

describe("AppShell", () => {
	it("has the skip link first, one main landmark that holds the page, and the sidebar", async () => {
		const { container } = await renderShell();

		expect(screen.getAllByRole("main")).toHaveLength(1);
		expect(screen.getByRole("main")).toContainElement(
			screen.getByText("page"),
		);
		expect(screen.getByRole("link", { name: "skip" })).toHaveAttribute(
			"href",
			"#main-content",
		);
		expect(container.querySelector("a, button")).toBe(
			screen.getByRole("link", { name: "skip" }),
		);
		expect(screen.getByRole("complementary")).toBeInTheDocument();
		expect(screen.getByRole("banner")).toBeInTheDocument();
	});

	it("draws the navigation it is given, in the sidebar, and nothing else", async () => {
		await renderShell();

		const sidebar = screen.getByRole("complementary");
		expect(sidebar).toContainElement(
			screen.getByRole("navigation", { name: "pages" }),
		);
		// The brand's link home and the one link of the navigation given.
		expect(sidebar.querySelectorAll("a")).toHaveLength(2);
	});

	it("starts collapsed or expanded as told", async () => {
		await renderShell({ defaultOpen: false });

		expect(document.querySelector("[data-slot='sidebar']")).toHaveAttribute(
			"data-state",
			"collapsed",
		);
	});

	it("puts the profile menu of the account in the header, not in the sidebar", async () => {
		await renderShell();

		const account = screen.getByRole("button", { name: "account" });
		expect(screen.getByRole("banner")).toContainElement(account);
		expect(screen.getByRole("complementary")).not.toContainElement(account);
		expect(account).toHaveTextContent("ops");
	});

	it("is as tall as the window and keeps the scrolling inside the content", async () => {
		await renderShell();

		// The frame never scrolls: the sidebar and the header stay in place.
		expect(
			document.querySelector("[data-slot='sidebar-wrapper']"),
		).toHaveClass("h-dvh");
		const inset = document.querySelector("[data-slot='sidebar-inset']");
		expect(inset).toHaveClass("min-h-0", "overflow-hidden");
		expect(screen.getByRole("banner")).toHaveClass("shrink-0");
		expect(inset?.lastElementChild).toBe(screen.getByRole("main"));
	});

	it("scrolls a page as a whole, inside the main landmark", async () => {
		await renderShell();

		const main = screen.getByRole("main");
		expect(main).toHaveAttribute("data-content", "page");
		expect(main).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
		// The column that holds the page is inside the scrolling box and is not
		// it: a flex column of a fixed height would squeeze what it holds.
		expect(main).not.toHaveClass("flex");
		const column = main.firstElementChild;
		expect(column).toHaveClass("flex", "flex-col", "p-4");
		expect(column).toContainElement(screen.getByText("page"));
	});

	it("leaves the scrolling to the panes of a page that has them", async () => {
		await renderShell({ content: "panes" });

		const main = screen.getByRole("main");
		expect(main).toHaveAttribute("data-content", "panes");
		expect(main).toHaveClass("min-h-0", "flex-1", "overflow-hidden");
		expect(main).not.toHaveClass("overflow-y-auto");
		expect(main.firstElementChild).toBe(screen.getByText("page"));
	});

	it("tells the three zones apart by their surface, with no line", async () => {
		await renderShell();

		const zones = [
			[
				document.querySelector("[data-slot='sidebar-inner']"),
				"bg-sidebar",
			],
			[screen.getByRole("banner"), "bg-header"],
			[
				document.querySelector("[data-slot='sidebar-inset']"),
				"bg-background",
			],
		] as const;
		for (const [zone, surface] of zones) {
			expect(zone).toHaveClass(surface);
			expect(zone?.className).not.toMatch(/(^|\s)(border|divide)-/);
		}
	});

	it("hands the header the trail, and the search cell only to an area that asks for it", async () => {
		await renderShell({ trail: <nav aria-label="trail">here</nav> });

		const banner = screen.getByRole("banner");
		expect(banner).toContainElement(
			screen.getByRole("navigation", { name: "trail" }),
		);
		expect(banner.querySelector("[data-slot='header-search']")).toBeNull();
		cleanup();

		await renderShell({ reserveSearch: true });
		expect(
			screen
				.getByRole("banner")
				.querySelector("[data-slot='header-search']"),
		).not.toBeNull();
	});

	it("puts what the area adds to the foot of the sidebar above the version", async () => {
		await renderShell({ sidebarFooter: <p>storage</p> });

		const foot = document.querySelector("[data-slot='sidebar-footer']");
		expect(foot?.firstElementChild).toBe(screen.getByText("storage"));
		expect(foot).toContainElement(
			document.querySelector<HTMLElement>("[data-slot='panel-version']"),
		);
	});

	it("uses no inline style", async () => {
		const { container } = await renderShell({ reserveSearch: true });

		expect(container.querySelector("[style]")).toBeNull();
	});
});
