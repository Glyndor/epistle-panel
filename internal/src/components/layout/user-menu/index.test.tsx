import { afterEach, describe, expect, it } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { resetIntl } from "@/test/next-intl";

const { UserMenu } = await import(".");

afterEach(() => {
	cleanup();
	resetIntl();
});

const account = () => screen.getByRole("button", { name: "account" });

describe("UserMenu", () => {
	it("renders a plain button, with no menu, until it is used", () => {
		render(<UserMenu name="ana" sessionRole="user" />);

		expect(account()).toHaveAttribute("aria-haspopup", "menu");
		expect(account()).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("warms the download on hover and focus without swapping the button", () => {
		render(<UserMenu name="ana" sessionRole="user" />);
		const button = account();

		fireEvent.pointerEnter(button);
		fireEvent.focus(button);

		expect(account()).toBe(button);
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("opens the real menu on a pointer press, and the menu takes the focus", async () => {
		render(<UserMenu name="ana" sessionRole="user" />);

		fireEvent.click(account(), { detail: 1 });

		expect(await screen.findByRole("menu")).toBeInTheDocument();
		expect(document.activeElement).toBe(screen.getByRole("menu"));
	});

	it("opens it from the keyboard with the focus on the first item", async () => {
		render(<UserMenu name="ana" sessionRole="user" />);

		fireEvent.click(account(), { detail: 0 });

		const items = await screen.findAllByRole("menuitemradio");
		await waitFor(() =>
			expect(document.activeElement).toBe(items[0] as HTMLElement),
		);
	});

	it("opens it on the down arrow too, before it was ever opened, with the focus on the first item", async () => {
		render(<UserMenu name="ana" sessionRole="user" />);

		fireEvent.keyDown(account(), { key: "ArrowDown" });

		const items = await screen.findAllByRole("menuitemradio");
		await waitFor(() =>
			expect(document.activeElement).toBe(items[0] as HTMLElement),
		);
	});

	it("hands the menu the account, its role and the way into the administration", async () => {
		render(
			<UserMenu name="ops" sessionRole="admin" adminHref="/app/abc" />,
		);

		fireEvent.click(account(), { detail: 1 });

		const menu = await screen.findByRole("menu");
		expect(menu).toHaveTextContent("ops");
		expect(menu).toHaveTextContent("role_admin");
		expect(
			screen.getByRole("menuitem", { name: "administration" }),
		).toHaveAttribute("href", "/app/abc");
	});
});
