import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SidebarProvider } from "../provider";
import { SidebarTrigger } from "../trigger";
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

	it("closes the sheet when a link inside it is followed, whoever drew the link, and not for anything else", () => {
		window.innerWidth = 400;
		const { container } = render(
			<SidebarProvider>
				<Sidebar
					title="Navigation"
					description="Pages"
					closeLabel="Close"
				>
					<p>Inside</p>
					<a href="#somewhere">
						<span>Somewhere</span>
					</a>
				</Sidebar>
				<SidebarTrigger label="Toggle" />
			</SidebarProvider>,
		);
		const dialog = container.querySelector("dialog") as HTMLDialogElement;
		const toggle = screen.getByRole("button", { name: "Toggle" });

		fireEvent.click(toggle);
		expect(dialog.open).toBe(true);

		// A click on what is no link leaves it open.
		fireEvent.click(screen.getByText("Inside"));
		expect(dialog.open).toBe(true);

		// A click anywhere in a link, also on what the link holds, closes it.
		fireEvent.click(screen.getByText("Somewhere"));
		expect(dialog.open).toBe(false);
	});

	it("does not animate its width for someone who asked for less motion", () => {
		const { container } = renderSidebar();

		for (const slot of ["sidebar-gap", "sidebar-container"]) {
			expect(
				container.querySelector(`[data-slot='${slot}']`),
			).toHaveClass(
				"transition-[width]",
				"motion-reduce:transition-none",
			);
		}
	});
});
