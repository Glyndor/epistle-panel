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

describe("NavUser", () => {
	it("shows who is signed in", () => {
		renderNav();

		expect(screen.getByText("signedInAs")).toBeInTheDocument();
	});

	it("offers the language entry as a plain button until it is used", () => {
		renderNav();

		const button = screen.getByRole("button", { name: "language" });
		expect(button).toHaveAttribute("aria-haspopup", "menu");
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("menu")).toBeNull();
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
});
