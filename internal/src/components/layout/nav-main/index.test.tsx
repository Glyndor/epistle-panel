import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { useSidebar } from "@/components/ui/sidebar/context";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import {
	adminNav,
	TEST_ROUTES,
} from "@/features/navigation/test-support/admin-nav";
import { TEST_ADMIN_ID } from "@/lib/config/test-support/admin-id";

let pathname = `/app/${TEST_ADMIN_ID}/domains`;
mock.module("next/navigation", () => ({
	usePathname: () => pathname,
	redirect: () => {
		throw new Error("NEXT_REDIRECT");
	},
}));

const { NavMain } = await import(".");

afterEach(() => {
	cleanup();
	window.innerWidth = 1024;
});

function Probe() {
	const { openMobile, setOpenMobile } = useSidebar();
	return (
		<button type="button" onClick={() => setOpenMobile(true)}>
			{`sheet-${openMobile}`}
		</button>
	);
}

function renderNav() {
	return render(
		<SidebarProvider>
			<NavMain groups={adminNav()} />
		</SidebarProvider>,
	);
}

describe("NavMain", () => {
	it("links the pages, with an icon each that assistive tech skips", () => {
		const { container } = renderNav();

		const nav = screen.getByRole("navigation", { name: "label" });
		const links = Array.from(nav.querySelectorAll("a"));
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			`/app/${TEST_ADMIN_ID}`,
			`/app/${TEST_ADMIN_ID}/domains`,
			`/app/${TEST_ADMIN_ID}/accounts`,
			`/app/${TEST_ADMIN_ID}/queue`,
			`/app/${TEST_ADMIN_ID}/deliveries`,
			`/app/${TEST_ADMIN_ID}/suppression`,
		]);
		expect(
			container.querySelectorAll("a > svg[aria-hidden='true']"),
		).toHaveLength(6);
	});

	it("marks only the current page with aria-current", () => {
		pathname = `/app/${TEST_ADMIN_ID}/domains`;
		renderNav();

		expect(screen.getByRole("link", { name: "domains" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		for (const name of ["status", "accounts", "queue"]) {
			expect(screen.getByRole("link", { name })).not.toHaveAttribute(
				"aria-current",
			);
		}
	});

	it("closes the mobile sheet when a link is followed", () => {
		window.innerWidth = 400;
		render(
			<SidebarProvider>
				<Probe />
				<NavMain groups={adminNav()} />
			</SidebarProvider>,
		);
		fireEvent.click(screen.getByRole("button", { name: "sheet-false" }));
		expect(
			screen.getByRole("button", { name: "sheet-true" }),
		).toBeInTheDocument();

		fireEvent.click(
			screen.getByRole("link", { name: "queue", hidden: true }),
		);

		expect(
			screen.getByRole("button", { name: "sheet-false", hidden: true }),
		).toBeInTheDocument();
	});

	it("keeps a section current below its own path, but not for look-alikes", () => {
		pathname = `/app/${TEST_ADMIN_ID}/queue/anything`;
		renderNav();
		expect(screen.getByRole("link", { name: "queue" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		cleanup();

		pathname = `/app/${TEST_ADMIN_ID}/queuex`;
		renderNav();
		expect(screen.getByRole("link", { name: "queue" })).not.toHaveAttribute(
			"aria-current",
		);
		cleanup();

		pathname = `/app/${TEST_ADMIN_ID}`;
		renderNav();
		expect(screen.getByRole("link", { name: "status" })).toHaveAttribute(
			"aria-current",
			"page",
		);
	});
});

describe("NavMain data", () => {
	it("draws exactly the groups it is given, with a label per group", () => {
		render(
			<SidebarProvider>
				<NavMain
					groups={[
						{
							label: "manage",
							items: [
								{
									href: TEST_ROUTES.queue,
									label: "queue",
									icon: "inbox",
								},
							],
						},
					]}
				/>
			</SidebarProvider>,
		);

		expect(screen.getAllByRole("link")).toHaveLength(1);
		expect(screen.getByText("manage")).toBeInTheDocument();
	});

	it("draws nothing for an empty navigation", () => {
		render(
			<SidebarProvider>
				<NavMain groups={[]} />
			</SidebarProvider>,
		);

		expect(screen.queryByRole("link")).toBeNull();
	});
});

describe("NavMain groups", () => {
	it("puts the pages under a heading that opens and closes them and says which it is", () => {
		renderNav();
		const heading = screen.getByRole("button", { name: "manage" });
		expect(heading).toHaveAttribute("aria-expanded", "true");

		fireEvent.click(heading);

		expect(heading).toHaveAttribute("aria-expanded", "false");
		// The page that is open stays: a closed group does not hide it.
		const kept = screen
			.getByRole("navigation", { name: "label" })
			.querySelectorAll("a");
		expect(kept).toHaveLength(1);
		expect(kept[0]).toHaveAttribute("aria-current", "page");

		fireEvent.click(heading);
		expect(
			screen
				.getByRole("navigation", { name: "label" })
				.querySelectorAll("a"),
		).toHaveLength(6);
	});

	it("is served with its pages and no style attribute", () => {
		const html = renderToString(
			<SidebarProvider>
				<NavMain groups={adminNav()} />
			</SidebarProvider>,
		);

		expect(html).toContain(`href="/app/${TEST_ADMIN_ID}/domains"`);
		expect(html).not.toContain("style=");
		expect(html).not.toContain("<style");
	});
});

describe("NavMain on the rail", () => {
	it("says in the tooltip of the current page that it is the current one, and only there", () => {
		render(
			<SidebarProvider defaultOpen={false}>
				<NavMain groups={adminNav()} />
			</SidebarProvider>,
		);
		const tip = () =>
			document.querySelector("[data-slot='sidebar-tooltip']");
		const nav = screen.getByRole("navigation", { name: "label" });
		const current = nav.querySelector(
			'a[aria-current="page"]',
		) as HTMLElement;
		const other = nav.querySelector("a:not([aria-current])") as HTMLElement;

		fireEvent.pointerEnter(current);
		expect(tip()).toHaveTextContent("currentEntry");
		fireEvent.keyDown(current, { key: "Escape" });

		fireEvent.pointerEnter(other);
		expect(tip()).not.toHaveTextContent("currentEntry");
	});
	it("left closed, a group still draws the entry of the current page, once, and no other", () => {
		pathname = `/app/${TEST_ADMIN_ID}/accounts/ana`;
		render(
			<SidebarProvider defaultClosedGroups={["manage"]}>
				<NavMain groups={adminNav()} />
			</SidebarProvider>,
		);

		expect(screen.getByRole("button", { name: "manage" })).toHaveAttribute(
			"aria-expanded",
			"false",
		);
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0]).toHaveAttribute(
			"href",
			`/app/${TEST_ADMIN_ID}/accounts`,
		);
		expect(links[0]).toHaveAttribute("aria-current", "page");

		fireEvent.click(screen.getByRole("button", { name: "manage" }));
		expect(screen.getAllByRole("link")).toHaveLength(6);
		expect(
			screen
				.getAllByRole("link")
				.filter((link) => link.hasAttribute("aria-current")),
		).toHaveLength(1);
	});

	it("is served closed with the current entry in the markup, so the first paint is the one that stays", () => {
		pathname = `/app/${TEST_ADMIN_ID}/queue`;
		const html = renderToString(
			<SidebarProvider defaultClosedGroups={["manage"]}>
				<NavMain groups={adminNav()} />
			</SidebarProvider>,
		);

		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain(`href="/app/${TEST_ADMIN_ID}/queue"`);
		expect(html).not.toContain(`href="/app/${TEST_ADMIN_ID}/domains"`);
		expect(html).not.toContain("style=");
	});
});
