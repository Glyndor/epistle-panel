import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SidebarProvider } from "../provider";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from ".";

afterEach(() => {
	cleanup();
	window.innerWidth = 1024;
});

function renderMenu(defaultOpen = true) {
	return render(
		<SidebarProvider defaultOpen={defaultOpen}>
			<SidebarMenu>
				<SidebarMenuItem>
					<SidebarMenuButton tooltip="Domains" isActive>
						<svg aria-hidden="true" />
						<span>Domains</span>
					</SidebarMenuButton>
				</SidebarMenuItem>
			</SidebarMenu>
		</SidebarProvider>,
	);
}

describe("SidebarMenuButton", () => {
	it("is 32px on a fine pointer and 44px on a coarse one", () => {
		renderMenu();

		expect(screen.getByRole("button", { name: "Domains" })).toHaveClass(
			"min-h-8",
			"pointer-coarse:min-h-11",
			"group-data-[collapsible=icon]:pointer-coarse:size-11",
		);
	});

	it("marks the active entry with data-active", () => {
		renderMenu();

		expect(screen.getByRole("button", { name: "Domains" })).toHaveAttribute(
			"data-active",
			"true",
		);
	});

	it("shows its tooltip only while the sidebar is collapsed", async () => {
		renderMenu(false);

		fireEvent.focus(screen.getByRole("button", { name: "Domains" }));

		expect(await screen.findByRole("tooltip")).toHaveTextContent("Domains");
	});

	it("keeps its tooltip hidden while the sidebar is expanded", async () => {
		renderMenu(true);

		fireEvent.focus(screen.getByRole("button", { name: "Domains" }));
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(screen.queryByRole("tooltip")).toBeNull();
	});

	it("mounts no tooltip in the mobile sheet, which would swallow Escape", async () => {
		window.innerWidth = 400;
		renderMenu(false);

		fireEvent.focus(screen.getByRole("button", { name: "Domains" }));
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(screen.queryByRole("tooltip")).toBeNull();
		expect(
			screen.getByRole("button", { name: "Domains" }),
		).not.toHaveAttribute("data-state");
	});

	it("renders without a tooltip when none is given", () => {
		render(
			<SidebarProvider>
				<SidebarMenuButton>Plain</SidebarMenuButton>
			</SidebarProvider>,
		);

		expect(
			screen.getByRole("button", { name: "Plain" }),
		).toBeInTheDocument();
	});
});
