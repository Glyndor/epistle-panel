import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SidebarContent, SidebarFooter, SidebarHeader, SidebarInset } from ".";

afterEach(cleanup);

describe("sidebar regions", () => {
	it("renders header, content and footer with their slots", () => {
		const { container } = render(
			<>
				<SidebarHeader>head</SidebarHeader>
				<SidebarContent>body</SidebarContent>
				<SidebarFooter>foot</SidebarFooter>
			</>,
		);

		for (const slot of ["header", "content", "footer"]) {
			expect(
				container.querySelector(`[data-slot='sidebar-${slot}']`),
			).not.toBeNull();
		}
		expect(screen.getByText("body")).toHaveClass("overflow-auto");
	});

	it("renders the inset as a div, so the layout owns the only main landmark", () => {
		render(<SidebarInset>content</SidebarInset>);

		expect(screen.getByText("content").tagName).toBe("DIV");
		expect(screen.queryByRole("main")).toBeNull();
	});
});
