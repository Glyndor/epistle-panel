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
		expect(screen.getByText("Manage")).toHaveClass(
			"group-data-[collapsible=icon]:opacity-0",
		);
		expect(screen.getByText("entries")).toBeInTheDocument();
	});
});
