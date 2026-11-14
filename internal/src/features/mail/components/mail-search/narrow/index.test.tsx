import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forgetListMemory } from "@/features/mail/components/message-list/list-memory";

import { NarrowSearch } from ".";

afterEach(() => {
	cleanup();
	forgetListMemory();
});

/**
 * The bar the search sits in: the trail on its left and the search's own cell
 * on its right. The search is a child of the bar, and the bar is what the
 * panel covers.
 */
function bar() {
	return (
		<header>
			<button type="button">the trail</button>
			<NarrowSearch label="search" closeLabel="close">
				<input type="search" aria-label="the field" />
			</NarrowSearch>
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
		expect(trail.hasAttribute("inert")).toBe(false);

		fireEvent.click(opener());

		// The panel covers the bar: what is under it is not reached, neither
		// by the pointer nor by the keyboard.
		expect(trail.hasAttribute("inert")).toBe(true);

		fireEvent.keyDown(document, { key: "Escape" });

		expect(trail.hasAttribute("inert")).toBe(false);
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
