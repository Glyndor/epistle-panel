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

	it("shows its tooltip beside the control on hover while the sidebar is collapsed", () => {
		renderMenu(false);

		fireEvent.pointerEnter(screen.getByRole("button", { name: "Domains" }));

		const tip = document.querySelector("[data-slot='sidebar-tooltip']");
		expect(tip).toHaveTextContent("Domains");
		expect(tip).toHaveAttribute("aria-hidden", "true");
		expect(tip).toHaveClass("fixed");
	});

	it("shows no tooltip while the sidebar is expanded, on touch, or in the mobile sheet", () => {
		renderMenu(true);
		fireEvent.pointerEnter(screen.getByRole("button", { name: "Domains" }));
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
		cleanup();

		renderMenu(false);
		fireEvent.pointerEnter(
			screen.getByRole("button", { name: "Domains" }),
			{
				pointerType: "touch",
			},
		);
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
		cleanup();

		window.innerWidth = 400;
		renderMenu(false);
		fireEvent.pointerEnter(screen.getByRole("button", { name: "Domains" }));
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
	});

	it("dismisses the tooltip with Escape", () => {
		renderMenu(false);
		const button = screen.getByRole("button", { name: "Domains" });
		fireEvent.pointerEnter(button);

		fireEvent.keyDown(button, { key: "Escape" });

		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
	});

	it("keeps the tooltip while the pointer moves onto it, and removes it after it leaves", async () => {
		renderMenu(false);
		const button = screen.getByRole("button", { name: "Domains" });
		fireEvent.pointerEnter(button);
		fireEvent.pointerLeave(button);
		const tip = document.querySelector(
			"[data-slot='sidebar-tooltip']",
		) as HTMLElement;

		fireEvent.pointerEnter(tip);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).not.toBeNull();

		fireEvent.pointerLeave(tip);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toBeNull();
	});

	it("runs the caller's own handlers too", () => {
		let entered = 0;
		render(
			<SidebarProvider defaultOpen={false}>
				<SidebarMenuButton tooltip="X" onPointerEnter={() => entered++}>
					X
				</SidebarMenuButton>
			</SidebarProvider>,
		);

		fireEvent.pointerEnter(screen.getByRole("button", { name: "X" }));

		expect(entered).toBe(1);
	});

	it("shows the tooltip on keyboard focus, not on a focus the pointer gave, and hides it on blur", async () => {
		renderMenu(false);
		const button = screen.getByRole("button", { name: "Domains" });
		const original = button.matches.bind(button);
		const tip = () =>
			document.querySelector("[data-slot='sidebar-tooltip']");

		// A focus that is not a keyboard one: no tooltip.
		button.matches = ((selector: string) =>
			selector === ":focus-visible"
				? false
				: original(selector)) as typeof button.matches;
		fireEvent.focus(button);
		expect(tip()).toBeNull();

		// A keyboard focus: the tooltip names the control.
		button.matches = ((selector: string) =>
			selector === ":focus-visible"
				? true
				: original(selector)) as typeof button.matches;
		fireEvent.focus(button);
		expect(tip()).toHaveTextContent("Domains");

		fireEvent.blur(button);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(tip()).toBeNull();
	});

	it("runs the caller's focus and blur handlers too", () => {
		const seen: string[] = [];
		render(
			<SidebarProvider defaultOpen={false}>
				<SidebarMenuButton
					tooltip="X"
					onFocus={() => seen.push("focus")}
					onBlur={() => seen.push("blur")}
				>
					X
				</SidebarMenuButton>
			</SidebarProvider>,
		);
		const button = screen.getByRole("button", { name: "X" });

		fireEvent.focus(button);
		fireEvent.blur(button);

		expect(seen).toEqual(["focus", "blur"]);
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
