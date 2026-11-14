import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { Sidebar } from "@/components/ui/sidebar/sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar/trigger";
import { NavSection } from ".";

afterEach(() => {
	cleanup();
	window.innerWidth = 1024;
});

function tree(defaultOpen = true, sectionOpen?: boolean) {
	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<Sidebar title="Navigation" description="Pages." closeLabel="Close">
				<NavSection
					label="Manage"
					{...(sectionOpen === undefined
						? {}
						: { defaultOpen: sectionOpen })}
				>
					<a href="/domains">Domains</a>
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

	it("can start closed", () => {
		render(tree(true, false));

		expect(heading()).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("link", { name: "Domains" })).toBeNull();
	});

	it("is a real button, as tall as a sidebar entry, with a ring of its own on the rail", () => {
		render(tree());

		expect(heading().tagName).toBe("BUTTON");
		expect(heading()).toHaveAttribute("type", "button");
		expect(heading()).toHaveClass(
			"h-8",
			"pointer-coarse:h-11",
			"focus-visible:outline-2",
			"focus-visible:outline-sidebar-ring",
			"hover:bg-sidebar-accent/60",
			"active:bg-sidebar-accent/80",
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

	it("is served closed with no style attribute either", () => {
		const html = renderToString(tree(true, false));

		expect(html).not.toContain('href="/domains"');
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain("style=");
	});
});
