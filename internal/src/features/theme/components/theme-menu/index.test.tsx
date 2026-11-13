import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { clearToasts, Toaster } from "@/components/ui/toaster";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { ThemeMenu } = await import(".");

const root = () => document.documentElement;
const themeWrites = () => cookies.writes.filter((w) => w.name === "theme");

beforeEach(() => {
	cookies.reset();
});
afterEach(() => {
	cleanup();
	clearToasts();
	root().removeAttribute("data-theme");
});

/** The menu on a document that shows `choice`, as the server would have painted it. */
function renderMenu(
	choice: "system" | "light" | "dark" = "system",
	defaultOpen = true,
) {
	if (choice === "system") {
		root().removeAttribute("data-theme");
	} else {
		root().setAttribute("data-theme", choice);
	}
	return render(
		<>
			<ThemeMenu defaultOpen={defaultOpen} />
			<Toaster label="toasts" closeLabel="close" />
		</>,
	);
}

describe("ThemeMenu", () => {
	it("starts closed, or open when asked to", async () => {
		renderMenu("system", false);
		expect(screen.queryByRole("menu")).toBeNull();
		expect(
			screen.getByRole("button", { name: "themeCurrent" }),
		).toHaveAttribute("aria-expanded", "false");
		cleanup();

		renderMenu("system", true);
		expect(await screen.findByRole("menu")).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "themeCurrent" }),
		).toHaveAttribute("aria-expanded", "true");
	});

	it("checks the theme the document shows", async () => {
		renderMenu("dark");

		expect(
			await screen.findByRole("menuitemradio", { name: "theme_dark" }),
		).toHaveAttribute("aria-checked", "true");
		expect(
			screen.getByRole("button", { name: "themeCurrent" }),
		).toHaveAttribute("data-theme-choice", "dark");
	});

	it("shows a pick at once and stores it through the Server Action", async () => {
		await cookies.signIn();
		renderMenu();

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "theme_dark" }),
		);

		// At once: the attribute is there before the action has answered.
		expect(root().getAttribute("data-theme")).toBe("dark");
		expect(themeWrites()).toEqual([]);
		await waitFor(() =>
			expect(themeWrites().map((w) => w.value)).toEqual(["dark"]),
		);
		expect(root().getAttribute("data-theme")).toBe("dark");
		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: "themeCurrent" }),
			).toHaveAttribute("data-theme-choice", "dark"),
		);
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("removes the attribute for system and stores that", async () => {
		await cookies.signIn();
		renderMenu("light");

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "theme_system" }),
		);

		expect(root().hasAttribute("data-theme")).toBe(false);
		await waitFor(() =>
			expect(themeWrites().map((w) => w.value)).toEqual(["system"]),
		);
	});

	it("puts the previous theme back and says so when the action refuses", async () => {
		// No session: the action answers false.
		renderMenu("light");

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "theme_dark" }),
		);
		expect(root().getAttribute("data-theme")).toBe("dark");

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"themeFailed",
		);
		expect(root().getAttribute("data-theme")).toBe("light");
		expect(themeWrites()).toEqual([]);
	});

	it("does nothing when the current theme is picked again", async () => {
		await cookies.signIn();
		renderMenu("system");

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "theme_system" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(themeWrites()).toEqual([]);
		expect(root().hasAttribute("data-theme")).toBe(false);
	});

	it("follows a change of the theme made by another control", async () => {
		renderMenu("system", false);
		const button = screen.getByRole("button", { name: "themeCurrent" });
		expect(button).toHaveAttribute("data-theme-choice", "system");

		root().setAttribute("data-theme", "dark");

		await waitFor(() =>
			expect(button).toHaveAttribute("data-theme-choice", "dark"),
		);
	});
});
