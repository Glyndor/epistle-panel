import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";

const { SiteHeader } = await import(".");

afterEach(cleanup);

const user = { name: "ops", role: "admin" } as const;

async function renderHeader(
	props: Partial<Parameters<typeof SiteHeader>[0]> = {},
) {
	return render(
		<SidebarProvider>
			{await SiteHeader({ user, ...props })}
		</SidebarProvider>,
	);
}

describe("SiteHeader", () => {
	it("has the sidebar toggle and no heading of its own", async () => {
		await renderHeader();

		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "toggle" }),
		).toBeInTheDocument();
		expect(screen.queryByRole("heading")).toBeNull();
	});

	it("is a surface of its own, apart from the rail and the canvas", async () => {
		await renderHeader();

		const banner = screen.getByRole("banner");
		expect(banner).toHaveClass("bg-header");
		expect(banner.className).not.toMatch(/\bborder/);
		expect(banner.className).not.toMatch(/\bshadow/);
	});

	it("draws the trail it is given after the toggle and before the far end", async () => {
		await renderHeader({ trail: <nav aria-label="trail">here</nav> });

		const banner = screen.getByRole("banner");
		const trail = screen.getByRole("navigation", { name: "trail" });
		const cell = banner.querySelector("[data-slot='header-trail']");
		expect(cell).toContainElement(trail);
		const order = [
			screen.getByRole("button", { name: "toggle" }),
			trail,
			screen.getByRole("button", { name: "themeCurrent" }),
			screen.getByRole("button", { name: "account" }),
		];
		for (const [index, node] of order.entries()) {
			const next = order[index + 1];
			if (next !== undefined) {
				expect(
					node.compareDocumentPosition(next) &
						Node.DOCUMENT_POSITION_FOLLOWING,
				).not.toBe(0);
			}
		}
	});

	it("lets the trail give way instead of taking a second row", async () => {
		await renderHeader({ trail: <nav aria-label="trail">here</nav> });

		// A cell with no width of its own never wraps to a new line: it shrinks,
		// and its steps are cut short.
		expect(
			screen
				.getByRole("banner")
				.querySelector("[data-slot='header-trail']"),
		).toHaveClass("min-w-0", "flex-1", "basis-0");
	});

	it("keeps no cell for a search in an area that has none", async () => {
		await renderHeader();

		expect(
			screen
				.getByRole("banner")
				.querySelector("[data-slot='header-search']"),
		).toBeNull();
	});

	it("keeps the middle of the bar for the search of an area that has one, even while it is empty", async () => {
		await renderHeader({ reserveSearch: true });

		const cell = screen
			.getByRole("banner")
			.querySelector("[data-slot='header-search']");
		expect(cell).not.toBeNull();
		expect(cell?.childElementCount).toBe(0);
		// Twice the trail's share from 1024 px; below that the trail has the row.
		expect(cell).toHaveClass("flex-2", "basis-0", "max-lg:hidden");
		cleanup();

		await renderHeader({
			reserveSearch: true,
			search: <input aria-label="search" />,
		});
		expect(
			screen
				.getByRole("banner")
				.querySelector("[data-slot='header-search']"),
		).toContainElement(screen.getByRole("textbox", { name: "search" }));
	});

	it("has the theme button, showing the theme of the document", async () => {
		await renderHeader();
		expect(
			screen.getByRole("button", { name: "themeCurrent" }),
		).toHaveAttribute("data-theme-choice", "system");
		cleanup();

		document.documentElement.setAttribute("data-theme", "dark");
		await renderHeader();
		expect(
			screen.getByRole("button", { name: "themeCurrent" }),
		).toHaveAttribute("data-theme-choice", "dark");
		document.documentElement.removeAttribute("data-theme");
	});

	it("keeps the theme button and the profile menu inside the banner, after the toggle", async () => {
		await renderHeader();

		const banner = screen.getByRole("banner");
		const buttons = [...banner.querySelectorAll("button")];
		expect(
			buttons.map((b) => b.querySelector(".sr-only")?.textContent),
		).toEqual(["toggle", "themeCurrent", "account"]);
	});

	it("is one row of the same least height in every area, never a fixed one", async () => {
		await renderHeader();

		const classes = screen.getByRole("banner").className.split(" ");
		expect(classes).toEqual(
			expect.arrayContaining([
				"flex-wrap",
				"shrink-0",
				"min-h-12",
				"pointer-coarse:min-h-14",
			]),
		);
		expect(classes.filter((name) => /(^|:)h-\d/.test(name))).toEqual([]);
	});

	it("tells the toggle's key to the tooltip and to assistive tech", async () => {
		await renderHeader();

		expect(screen.getByRole("button", { name: "toggle" })).toHaveAttribute(
			"aria-keyshortcuts",
			"Control+B Meta+B",
		);
	});
});
