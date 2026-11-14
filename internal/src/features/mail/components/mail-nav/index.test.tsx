import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { firstPaint } from "@/test/server-tree";

import { MailNav } from ".";

afterEach(cleanup);

/** The navigation as it is first sent: the folders give way to their skeleton. */
async function renderNav(open = true) {
	return render(
		<SidebarProvider defaultOpen={open}>
			{firstPaint(await MailNav())}
		</SidebarProvider>,
	);
}

describe("MailNav", () => {
	it("starts with the way into the composer, an icon and its name", async () => {
		await renderNav();

		const write = screen.getByRole("link", { name: "compose" });
		expect(write).toHaveAttribute("href", "/app/mail/compose");
		expect(write.querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(document.querySelector("a, button")).toBe(write);
	});

	it("draws the composer as the filled entry of the rail, its ring off the fill", async () => {
		await renderNav();

		expect(screen.getByRole("link", { name: "compose" })).toHaveClass(
			"bg-primary",
			"text-primary-foreground",
			"hover:bg-primary/90",
			"active:bg-primary/80",
			"focus-visible:outline-2",
			"focus-visible:outline-offset-2",
			"min-h-8",
			"pointer-coarse:min-h-11",
		);
	});

	it("names the composer in a tooltip while the rail is collapsed to icons", async () => {
		await renderNav(false);

		fireEvent.pointerEnter(screen.getByRole("link", { name: "compose" }));

		expect(
			document.querySelector("[data-slot='sidebar-tooltip']"),
		).toHaveTextContent("compose");
	});

	it("sends the skeleton of the folders before the mail server is asked", async () => {
		const { container } = await renderNav();

		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(
			screen.queryByRole("navigation", { name: "folders" }),
		).toBeNull();
	});
});
