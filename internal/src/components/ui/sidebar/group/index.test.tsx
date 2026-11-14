import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SidebarGroup, SidebarGroupContent, SidebarGroupLabel } from ".";

afterEach(cleanup);

describe("SidebarGroup", () => {
	it("composes a label and its content", () => {
		const { container } = render(
			<SidebarGroup>
				<SidebarGroupLabel>Manage</SidebarGroupLabel>
				<SidebarGroupContent>entries</SidebarGroupContent>
			</SidebarGroup>,
		);

		expect(
			container.querySelector("[data-slot='sidebar-group']"),
		).not.toBeNull();
		// Collapsed to icons the heading is not drawn, and is no stop for Tab.
		expect(screen.getByText("Manage")).toHaveClass(
			"group-data-[collapsible=icon]:hidden",
		);
		expect(screen.getByText("entries")).toBeInTheDocument();
	});

	it("is the element given as its child when asked, with the heading's look", () => {
		render(
			<SidebarGroup>
				<SidebarGroupLabel asChild>
					<button type="button">Manage</button>
				</SidebarGroupLabel>
			</SidebarGroup>,
		);

		const heading = screen.getByRole("button", { name: "Manage" });
		expect(heading).toHaveAttribute("data-slot", "sidebar-group-label");
		expect(heading).toHaveClass(
			"h-8",
			"group-data-[collapsible=icon]:hidden",
		);
	});
});
