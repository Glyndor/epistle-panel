import { afterEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { ThemeChoiceProvider } from "@/features/theme/components/theme-choice-provider";

const { ThemeSwitcher } = await import(".");

const root = () => document.documentElement;

afterEach(() => {
	cleanup();
	root().removeAttribute("data-theme");
});

describe("ThemeSwitcher", () => {
	it("renders a plain button, with no menu, until it is used", () => {
		render(<ThemeSwitcher />);

		const button = screen.getByRole("button", { name: "themeCurrent" });
		expect(button).toHaveAttribute("aria-haspopup", "menu");
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("is the system's choice on the server without a provider", () => {
		root().setAttribute("data-theme", "dark");

		expect(renderToString(<ThemeSwitcher />)).toContain(
			'data-theme-choice="system"',
		);
	});

	it("is rendered on the server with the choice the server read", () => {
		// The document shows another theme: the server render must not look at it.
		root().setAttribute("data-theme", "light");

		const html = renderToString(
			<ThemeChoiceProvider choice="dark">
				<ThemeSwitcher />
			</ThemeChoiceProvider>,
		);

		expect(html).toContain('data-theme-choice="dark"');
	});

	it("shows the theme of the document once it runs in the browser", async () => {
		root().setAttribute("data-theme", "dark");
		render(<ThemeSwitcher />);
		const button = screen.getByRole("button", { name: "themeCurrent" });
		expect(button).toHaveAttribute("data-theme-choice", "dark");

		root().removeAttribute("data-theme");

		await waitFor(() =>
			expect(button).toHaveAttribute("data-theme-choice", "system"),
		);
	});

	it("warms the download on hover and focus without swapping the button", () => {
		render(<ThemeSwitcher />);
		const button = screen.getByRole("button", { name: "themeCurrent" });

		fireEvent.pointerEnter(button);
		fireEvent.focus(button);

		expect(screen.getByRole("button", { name: "themeCurrent" })).toBe(
			button,
		);
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("opens the real menu on a pointer press, and the menu takes the focus", async () => {
		render(<ThemeSwitcher />);

		// A pointer click counts its presses; one from the keyboard says 0.
		fireEvent.click(screen.getByRole("button", { name: "themeCurrent" }), {
			detail: 1,
		});

		expect(await screen.findByRole("menu")).toBeInTheDocument();
		expect(await screen.findAllByRole("menuitemradio")).toHaveLength(3);
		expect(document.activeElement).toBe(screen.getByRole("menu"));
	});

	it("opens it from the keyboard with the focus on the first item", async () => {
		root().setAttribute("data-theme", "dark");
		render(<ThemeSwitcher />);

		fireEvent.click(screen.getByRole("button", { name: "themeCurrent" }), {
			detail: 0,
		});

		const items = await screen.findAllByRole("menuitemradio");
		expect(items[0]).toHaveTextContent("theme_system");
		await waitFor(() =>
			expect(document.activeElement).toBe(items[0] as HTMLElement),
		);
	});
});
