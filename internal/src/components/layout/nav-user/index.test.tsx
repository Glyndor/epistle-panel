import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { SidebarProvider } from "@/components/ui/sidebar/provider";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();

const { NavUser } = await import(".");

beforeEach(() => {
	cookies.reset();
});
afterEach(cleanup);

function renderNav() {
	return render(
		<SidebarProvider>
			<NavUser name="admin" />
		</SidebarProvider>,
	);
}

function openLanguageMenu() {
	fireEvent.keyDown(screen.getByRole("button", { name: "language" }), {
		key: "Enter",
	});
}

describe("NavUser", () => {
	it("shows who is signed in", () => {
		renderNav();

		expect(screen.getByText("signedInAs")).toBeInTheDocument();
	});

	it("offers Sign out as a plain form button that exists in the server HTML", () => {
		const { container } = renderNav();

		const button = screen.getByRole("button", { name: "logout" });
		expect(button).toHaveAttribute("type", "submit");
		expect(button.closest("form")).not.toBeNull();
		expect(
			container.querySelector("svg[aria-hidden='true']"),
		).not.toBeNull();
	});

	it("lists both languages with the current one checked", async () => {
		renderNav();
		openLanguageMenu();

		const items = await screen.findAllByRole("menuitemradio");
		expect(items.map((item) => item.getAttribute("lang"))).toEqual([
			"en",
			"es",
		]);
		expect(items[0]).toHaveAttribute("aria-checked", "true");
		expect(items[1]).toHaveAttribute("aria-checked", "false");
	});

	it("stores the chosen language through the Server Action for a signed-in admin", async () => {
		await cookies.signIn();
		renderNav();
		openLanguageMenu();

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "languageEs" }),
		);

		await waitFor(() => {
			expect(
				cookies.writes.some(
					(w) => w.name === "locale" && w.value === "es",
				),
			).toBe(true);
		});
	});

	it("does nothing when the current language is picked again", async () => {
		await cookies.signIn();
		renderNav();
		openLanguageMenu();

		fireEvent.click(
			await screen.findByRole("menuitemradio", { name: "languageEn" }),
		);
		await new Promise((resolve) => setTimeout(resolve, 20));

		expect(cookies.writes).toEqual([]);
	});
});
