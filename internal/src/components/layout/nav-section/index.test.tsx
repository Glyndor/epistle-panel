import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { Sidebar } from "@/components/ui/sidebar/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar/trigger";
import { captureCookieWrites } from "@/test/cookie-capture";
import { NavSection } from ".";

let capture: ReturnType<typeof captureCookieWrites> | undefined;

afterEach(() => {
	cleanup();
	capture?.restore();
	capture = undefined;
	window.innerWidth = 1024;
});

function tree({
	sidebarOpen = true,
	closed = false,
	current,
}: {
	sidebarOpen?: boolean;
	closed?: boolean;
	current?: React.ReactNode;
} = {}) {
	return (
		<SidebarProvider
			defaultOpen={sidebarOpen}
			defaultClosedGroups={closed ? ["manage"] : []}
		>
			<Sidebar title="Navigation" description="Pages." closeLabel="Close">
				<NavSection id="manage" label="Manage" current={current}>
					<a href="/domains">Domains</a>
					<a href="/accounts">Accounts</a>
				</NavSection>
			</Sidebar>
			<SidebarTrigger label="Toggle sidebar" />
		</SidebarProvider>
	);
}

const heading = () => screen.getByRole("button", { name: "Manage" });

describe("NavSection", () => {
	it("starts open, and its heading is a button that says so and what it controls", () => {
		render(tree());

		expect(heading()).toHaveAttribute("aria-expanded", "true");
		const controlled = heading().getAttribute("aria-controls");
		expect(controlled).not.toBeNull();
		expect(document.getElementById(controlled ?? "")).toContainElement(
			screen.getByRole("link", { name: "Domains" }),
		);
	});

	it("is a group of the sidebar like any other, which also says whether it is open", () => {
		render(tree());

		const group = heading().closest("[data-slot='sidebar-group']");
		expect(group).not.toBeNull();
		expect(group).toHaveAttribute("data-state", "open");
		expect(group).toContainElement(
			screen.getByRole("link", { name: "Domains" }),
		);
		fireEvent.click(heading());
		expect(group).toHaveAttribute("data-state", "closed");
	});

	it("closes and opens again from its heading, and a closed one keeps its entries out of the page", () => {
		render(tree());

		// Enter and Space on a button arrive as a click.
		fireEvent.click(heading());
		expect(heading()).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("link", { name: "Domains" })).toBeNull();

		fireEvent.click(heading());
		expect(heading()).toHaveAttribute("aria-expanded", "true");
		expect(
			screen.getByRole("link", { name: "Domains" }),
		).toBeInTheDocument();
	});

	it("starts closed when the shell says the group was left closed", () => {
		render(tree({ closed: true }));

		expect(heading()).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("link", { name: "Domains" })).toBeNull();
	});

	it("keeps the choice for the next page: closing writes the group's cookie for the whole panel, opening takes it away", () => {
		capture = captureCookieWrites();
		const { writes } = capture;
		render(tree());
		expect(writes).toEqual([]);

		fireEvent.click(heading());
		expect(writes).toEqual([
			"sidebar_groups=manage; path=/; max-age=31536000; SameSite=Lax",
		]);

		fireEvent.click(heading());
		expect(writes.at(-1)).toBe(
			"sidebar_groups=; path=/; max-age=0; SameSite=Lax",
		);
	});

	it("closed, still draws the entry of the current page, and nothing else of the group", () => {
		render(
			tree({
				closed: true,
				current: (
					<a href="/accounts" aria-current="page">
						Accounts
					</a>
				),
			}),
		);

		expect(heading()).toHaveAttribute("aria-expanded", "false");
		const kept = screen.getByRole("link", { name: "Accounts" });
		expect(kept).toHaveAttribute("aria-current", "page");
		expect(
			kept.closest("[data-slot='sidebar-group-current']"),
		).not.toBeNull();
		expect(screen.queryByRole("link", { name: "Domains" })).toBeNull();
		// It is not part of what the heading opens and closes.
		expect(kept.closest("[data-slot='collapsible-content']")).toBeNull();
	});

	it("open, draws each entry once: the current one is not repeated", () => {
		render(
			tree({
				current: (
					<a href="/accounts" aria-current="page">
						Accounts
					</a>
				),
			}),
		);

		expect(screen.getAllByRole("link", { name: "Accounts" })).toHaveLength(
			1,
		);
		expect(
			document.querySelector("[data-slot='sidebar-group-current']"),
		).toBeNull();

		fireEvent.click(heading());
		expect(screen.getAllByRole("link", { name: "Accounts" })).toHaveLength(
			1,
		);
		expect(
			document.querySelector("[data-slot='sidebar-group-current']"),
		).not.toBeNull();
	});

	it("is a real button, as tall as a sidebar entry, with a ring of its own on the rail", () => {
		render(tree());

		expect(heading().tagName).toBe("BUTTON");
		expect(heading()).toHaveAttribute("type", "button");
		expect(heading()).toHaveClass(
			"h-8",
			"pointer-coarse:h-11",
			"focus-visible:outline-2",
			// Inside the heading: the entry under it would cover a ring around it.
			"focus-visible:-outline-offset-2",
			"focus-visible:outline-sidebar-ring",
			"hover:bg-sidebar-accent/60",
			"active:bg-sidebar-accent-press",
		);
		expect(heading().querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	});

	it("shows its entries while the rail is collapsed to icons, whatever was chosen, and gives the choice back", () => {
		render(tree());
		fireEvent.click(heading());
		expect(screen.queryByRole("link", { name: "Domains" })).toBeNull();

		// Collapsed, there is no heading to press: the entries are all there.
		fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
		expect(
			screen.getByRole("link", { name: "Domains" }),
		).toBeInTheDocument();
		expect(
			document.querySelector("[data-slot='sidebar-group-label']"),
		).toHaveClass("group-data-[collapsible=icon]:hidden");

		// Expanded again, the group is closed as it was left.
		fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
		expect(heading()).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("link", { name: "Domains" })).toBeNull();
	});

	it("is served open with its entries and no style attribute", () => {
		const html = renderToString(tree());

		expect(html).toContain('href="/domains"');
		expect(html).toContain('aria-expanded="true"');
		expect(html).not.toContain("style=");
		expect(html).not.toContain("<style");
	});

	it("is served closed with no style attribute either, and with the current entry when there is one", () => {
		const html = renderToString(tree({ closed: true }));

		expect(html).not.toContain('href="/domains"');
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain("style=");

		const withCurrent = renderToString(
			tree({ closed: true, current: <a href="/accounts">Accounts</a> }),
		);
		expect(withCurrent).toContain('href="/accounts"');
		expect(withCurrent).not.toContain('href="/domains"');
		expect(withCurrent).not.toContain("style=");
	});

	it("on the rail shows every entry of a group that was left closed, each once", () => {
		render(
			tree({
				sidebarOpen: false,
				closed: true,
				current: <a href="/accounts">Accounts</a>,
			}),
		);

		expect(
			screen.getByRole("link", { name: "Domains" }),
		).toBeInTheDocument();
		expect(screen.getAllByRole("link", { name: "Accounts" })).toHaveLength(
			1,
		);
	});
});
