import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forgetListMemory } from "@/features/mail/components/message-list/list-memory";

import { NarrowSearch } from ".";

afterEach(() => {
	cleanup();
	forgetListMemory();
});

/**
 * The bar the search sits in: the trail on its left, the search's own cell in
 * a part of its own and the actions at the far end. The cell is a grandchild
 * of the bar, as it is in the header of the panel, and the bar is what the
 * panel covers.
 */
function bar() {
	return (
		<header>
			<button type="button">the trail</button>
			<div data-slot="header-search">
				<NarrowSearch label="search" closeLabel="close">
					<input type="search" aria-label="the field" />
				</NarrowSearch>
			</div>
			<button type="button">the actions</button>
		</header>
	);
}

/** The icon that opens the field. */
const opener = () => screen.getByRole("button", { name: "search" });
/** The field the panel draws. */
const field = () => screen.getByRole("searchbox", { name: "the field" });
/** The panel that draws the field over the bar. */
const panel = () => field().parentElement as HTMLElement;

describe("NarrowSearch", () => {
	it("keeps the field to itself until the icon opens it", () => {
		render(bar());

		expect(opener()).toHaveAttribute("aria-expanded", "false");
		// Closed, the panel takes no room and shows nothing.
		expect(panel().className).toContain("hidden");

		fireEvent.click(opener());

		expect(opener()).toHaveAttribute("aria-expanded", "true");
		expect(panel().className).not.toContain("hidden");
	});

	it("puts the focus in the field when it opens it, not in the icon", () => {
		render(bar());

		fireEvent.click(opener());

		// The field itself holds the focus: a person can type at once.
		expect(document.activeElement).toBe(field());
		expect(panel().contains(document.activeElement)).toBe(true);
		expect(document.activeElement).not.toBe(opener());
	});

	it("closes with Escape and gives the focus back to the icon", () => {
		render(bar());
		fireEvent.click(opener());

		fireEvent.keyDown(document, { key: "Escape" });

		expect(opener()).toHaveAttribute("aria-expanded", "false");
		expect(document.activeElement).toBe(opener());
	});

	it("closes with Escape even when the focus is in the field", () => {
		render(bar());
		fireEvent.click(opener());
		field().focus();

		fireEvent.keyDown(field(), { key: "Escape" });

		expect(opener()).toHaveAttribute("aria-expanded", "false");
	});

	it("closes with the control that takes the search back", () => {
		render(bar());
		fireEvent.click(opener());

		fireEvent.click(screen.getByRole("button", { name: "close" }));

		expect(opener()).toHaveAttribute("aria-expanded", "false");
		expect(document.activeElement).toBe(opener());
	});

	it("keeps the rest of the bar out of the way while it is open", () => {
		render(bar());
		const trail = screen.getByRole("button", { name: "the trail" });
		const actions = screen.getByRole("button", { name: "the actions" });
		const holder = document.querySelector(
			'[data-slot="header-search"]',
		) as HTMLElement;
		expect(trail.hasAttribute("inert")).toBe(false);
		expect(actions.hasAttribute("inert")).toBe(false);

		fireEvent.click(opener());

		// The panel covers the bar: what is under it is not reached, neither
		// by the pointer nor by the keyboard.
		expect(trail.hasAttribute("inert")).toBe(true);
		expect(actions.hasAttribute("inert")).toBe(true);
		// The part of the bar that holds the cell is not inert: the field is
		// inside it, and an inert ancestor would take it out of reach.
		expect(holder.hasAttribute("inert")).toBe(false);
		expect(holder.contains(field())).toBe(true);
		expect(field().closest("[inert]")).toBeNull();

		fireEvent.keyDown(document, { key: "Escape" });

		expect(trail.hasAttribute("inert")).toBe(false);
		expect(actions.hasAttribute("inert")).toBe(false);
	});

	it("leaves the icon out of the tab order while the panel is over the bar", () => {
		render(bar());

		expect(opener().hasAttribute("tabindex")).toBe(false);

		fireEvent.click(opener());

		// The icon is behind the panel: it is not a stop of the tab order,
		// and the panel gives the focus back to it when it closes.
		expect(opener()).toHaveAttribute("tabindex", "-1");

		fireEvent.keyDown(document, { key: "Escape" });

		expect(opener().hasAttribute("tabindex")).toBe(false);
	});

	it("is a button the keyboard can reach, with the name of the search", () => {
		render(bar());
		const button = opener();

		// A native button: the browser activates it with Enter and with
		// Space, and it takes the focus on the Tab key.
		expect(button.tagName).toBe("BUTTON");
		expect(button).toHaveAttribute("type", "button");
		expect(button.hasAttribute("tabindex")).toBe(false);

		button.focus();
		expect(document.activeElement).toBe(button);
	});
});
