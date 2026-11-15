import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { AccountsHeading } from ".";

afterEach(cleanup);

describe("AccountsHeading", () => {
	it("is the page's h1 with one line saying what the page is for", () => {
		render(<AccountsHeading />);

		const heading = screen.getByRole("heading", { level: 1 });
		expect(heading).toHaveTextContent("heading");
		expect(heading.nextElementSibling).toHaveTextContent("description");
	});

	it("wears the people tile, hidden from assistive technology", () => {
		const { container } = render(<AccountsHeading />);
		const tile = container.querySelector('[data-slot="icon-tile"]');

		expect(tile).toHaveAttribute("aria-hidden", "true");
		expect(tile?.querySelector('[data-glyph="users"]')).not.toBeNull();
	});

	it("keeps the way to a new account as the primary action, at the end of the header", () => {
		const { container } = render(<AccountsHeading />);
		const actions = container.querySelector(
			'[data-slot="page-header-actions"]',
		);

		expect(actions).not.toBeNull();
		expect(actions).toContainElement(
			screen.getByRole("button", { name: "create" }),
		);
		expect(container.firstElementChild?.lastElementChild).toBe(actions);
	});
});
