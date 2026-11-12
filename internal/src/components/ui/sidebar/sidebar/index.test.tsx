import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { SidebarProvider } from "../provider";
import { Sidebar } from ".";

afterEach(() => {
	cleanup();
	window.innerWidth = 1024;
});

function renderSidebar(defaultOpen = true) {
	return render(
		<SidebarProvider defaultOpen={defaultOpen}>
			<Sidebar title="Navigation" description="Pages" closeLabel="Close">
				<p>Inside</p>
			</Sidebar>
		</SidebarProvider>,
	);
}

describe("Sidebar", () => {
	it("renders a rail that reports whether it is expanded", () => {
		const { container } = renderSidebar();

		const root = container.querySelector("[data-slot='sidebar']");
		expect(root).toHaveAttribute("data-state", "expanded");
		expect(root).toHaveAttribute("data-collapsible", "");
		expect(screen.getByText("Inside")).toBeInTheDocument();
	});

	it("is a named complementary landmark, so its controls sit inside a region", () => {
		renderSidebar();

		expect(
			screen.getByRole("complementary", { name: "Navigation" }),
		).toContainElement(screen.getByText("Inside"));
	});

	it("collapses to icons, not off screen", () => {
		const { container } = renderSidebar(false);

		const root = container.querySelector("[data-slot='sidebar']");
		expect(root).toHaveAttribute("data-state", "collapsed");
		expect(root).toHaveAttribute("data-collapsible", "icon");
	});

	it("hides the rail below md and shows no inline style", () => {
		const { container } = renderSidebar();

		expect(container.querySelector("[data-slot='sidebar']")).toHaveClass(
			"hidden",
			"md:block",
		);
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("is a sheet on a narrow viewport, closed until it is opened", () => {
		window.innerWidth = 400;
		const { container } = renderSidebar();

		const dialog = container.querySelector("dialog") as HTMLDialogElement;
		expect(dialog).not.toBeNull();
		expect(dialog.open).toBe(false);
		const labelId = dialog.getAttribute("aria-labelledby") as string;
		expect(document.getElementById(labelId)).toHaveTextContent(
			"Navigation",
		);
		expect(
			container.querySelector("[data-slot='sidebar-container']"),
		).toBeNull();
	});
});
