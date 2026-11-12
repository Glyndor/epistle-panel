import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { useSidebar } from "@/components/ui/sidebar/context";
import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { navForRole } from "@/features/navigation/queries/nav-for-role";

let pathname = "/domains";
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
			<NavMain groups={navForRole("admin")} />
		</SidebarProvider>,
	);
}

describe("NavMain", () => {
	it("links the pages, with an icon each that assistive tech skips", () => {
		const { container } = renderNav();

		const nav = screen.getByRole("navigation", { name: "label" });
		const links = Array.from(nav.querySelectorAll("a"));
		expect(links.map((link) => link.getAttribute("href"))).toEqual([
			"/",
			"/domains",
			"/accounts",
			"/queue",
			"/app/deliveries",
			"/app/suppression",
		]);
		expect(
			container.querySelectorAll("a > svg[aria-hidden='true']"),
		).toHaveLength(6);
	});

	it("marks only the current page with aria-current", () => {
		pathname = "/domains";
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
				<NavMain groups={navForRole("admin")} />
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
		pathname = "/queue/anything";
		renderNav();
		expect(screen.getByRole("link", { name: "queue" })).toHaveAttribute(
			"aria-current",
			"page",
		);
		cleanup();

		pathname = "/queuex";
		renderNav();
		expect(screen.getByRole("link", { name: "queue" })).not.toHaveAttribute(
			"aria-current",
		);
		cleanup();

		pathname = "/";
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
									href: "/queue",
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
