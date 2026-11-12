import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";

const { LanguageSwitcher } = await import(".");

afterEach(cleanup);

function renderSwitcher() {
	return render(
		<SidebarProvider>
			<LanguageSwitcher />
		</SidebarProvider>,
	);
}

describe("LanguageSwitcher", () => {
	it("renders a plain button, with no menu, until it is used", () => {
		renderSwitcher();

		const button = screen.getByRole("button", { name: "language" });
		expect(button).toHaveAttribute("aria-haspopup", "menu");
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("warms the download on hover and focus without swapping the button", () => {
		renderSwitcher();
		const button = screen.getByRole("button", { name: "language" });

		fireEvent.pointerEnter(button);
		fireEvent.focus(button);

		expect(screen.getByRole("button", { name: "language" })).toBe(button);
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("opens the real menu on a press, and the menu takes the focus", async () => {
		renderSwitcher();

		fireEvent.click(screen.getByRole("button", { name: "language" }));

		expect(await screen.findByRole("menu")).toBeInTheDocument();
		expect(await screen.findAllByRole("menuitemradio")).toHaveLength(2);
		expect(screen.getByRole("menu")).toContainElement(
			document.activeElement as HTMLElement,
		);
	});
});
