import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Tooltip } from ".";
import { keyboardFocus, renderTip, tip } from "./test-support";

afterEach(cleanup);

/**
 * What sends a tooltip away and what brings it back: a press, Escape, another
 * control under the pointer, the focus coming back. Beside `index.test.tsx`,
 * which holds where it is drawn and what it says.
 */
describe("Tooltip: sent away and brought back", () => {
	it("is dismissed by Escape, and by using the control", () => {
		const button = renderTip();

		fireEvent.pointerEnter(button);
		fireEvent.keyDown(button, { key: "Escape" });
		expect(tip()).toBeNull();

		fireEvent.pointerEnter(button);
		fireEvent.pointerDown(button);
		expect(tip()).toBeNull();

		for (const key of ["Enter", " "]) {
			// The focus comes from elsewhere each time: a control that was just
			// used does not show its name again when the focus only returns.
			fireEvent.blur(button);
			keyboardFocus(button, true);
			fireEvent.focus(button);
			expect(tip()).not.toBeNull();
			fireEvent.keyDown(button, { key });
			expect(tip()).toBeNull();
		}
	});

	it("stays while the pointer moves onto it, and goes after it leaves", async () => {
		const button = renderTip();
		fireEvent.pointerEnter(button);
		fireEvent.pointerLeave(button);

		fireEvent.pointerEnter(tip() as HTMLElement);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(tip()).not.toBeNull();

		fireEvent.pointerLeave(tip() as HTMLElement);
		await new Promise((resolve) => setTimeout(resolve, 200));
		expect(tip()).toBeNull();
	});

	it("gives way at once to another control the pointer finds under it, and stays over its own and over nothing", () => {
		render(
			<>
				<Tooltip label="Actions for one">
					<button type="button">one</button>
				</Tooltip>
				<button type="button">two</button>
				<p>plain text</p>
			</>,
		);
		const one = screen.getByRole("button", { name: "one" });
		const two = screen.getByRole("button", { name: "two" });
		const text = screen.getByText("plain text");
		const found = document.elementsFromPoint;
		let under: Element[] = [];
		document.elementsFromPoint = () => under;
		try {
			// Over empty space and over text it can be reached and read.
			fireEvent.pointerEnter(one);
			const box = tip() as HTMLElement;
			under = [box, text, document.body];
			fireEvent.pointerEnter(box);
			fireEvent.pointerMove(box);
			expect(tip()).not.toBeNull();

			// Over its own control it stays.
			under = [box, one, document.body];
			fireEvent.pointerMove(box);
			expect(tip()).not.toBeNull();

			// Over the button of the next row it goes, with no wait: the press is that button's.
			under = [box, two, document.body];
			fireEvent.pointerMove(box);
			expect(tip()).toBeNull();

			// And again the next time: nothing of the first time is kept.
			fireEvent.pointerEnter(one);
			const again = tip() as HTMLElement;
			expect(again).not.toBeNull();
			under = [again, two, document.body];
			fireEvent.pointerMove(again);
			expect(tip()).toBeNull();
		} finally {
			document.elementsFromPoint = found;
		}
	});

	it("shows for a pointer that is found over the control with no entry told, and not again after a press or Escape", () => {
		const button = renderTip();

		// Another tooltip lay over the control and went: the pointer is on it and only moves.
		expect(tip()).toBeNull();
		fireEvent.pointerMove(button);
		expect(tip()).toHaveTextContent("Toggle sidebar");

		// A press sends it away, and moving on the control does not bring it back.
		fireEvent.pointerDown(button);
		expect(tip()).toBeNull();
		fireEvent.pointerMove(button);
		fireEvent.pointerMove(button);
		expect(tip()).toBeNull();

		// A new visit starts again.
		fireEvent.pointerLeave(button);
		fireEvent.pointerMove(button);
		expect(tip()).not.toBeNull();

		// Escape sends it away the same way, until the pointer leaves.
		fireEvent.keyDown(button, { key: "Escape" });
		expect(tip()).toBeNull();
		fireEvent.pointerMove(button);
		expect(tip()).toBeNull();
		fireEvent.pointerLeave(button);
		fireEvent.pointerMove(button);
		expect(tip()).not.toBeNull();

		// A finger moving on the control shows nothing.
		fireEvent.pointerLeave(button);
		fireEvent.pointerDown(button);
		fireEvent.pointerLeave(button);
		cleanup();
		const touched = renderTip();
		fireEvent.pointerMove(touched, { pointerType: "touch" });
		expect(tip()).toBeNull();
	});

	it("is dismissed by Escape wherever the focus is, and listens for it only while it shows", () => {
		render(
			<>
				<Tooltip label="Toggle sidebar">
					<button type="button">
						<span className="sr-only">Toggle sidebar</span>
					</button>
				</Tooltip>
				<input aria-label="Filter" />
			</>,
		);
		const button = screen.getByRole("button", { name: "Toggle sidebar" });
		const field = screen.getByRole("textbox", { name: "Filter" });

		// The pointer brought it up; the focus is on nothing.
		fireEvent.pointerEnter(button);
		expect(tip()).not.toBeNull();
		expect(document.activeElement).not.toBe(button);
		fireEvent.keyDown(document.body, { key: "Escape" });
		expect(tip()).toBeNull();
		// It stays away for the rest of the visit.
		fireEvent.pointerMove(button);
		expect(tip()).toBeNull();

		// The same with the focus in a field elsewhere.
		fireEvent.pointerLeave(button);
		field.focus();
		fireEvent.pointerMove(button);
		expect(tip()).not.toBeNull();
		fireEvent.keyDown(field, { key: "Escape" });
		expect(tip()).toBeNull();

		// Another key leaves it alone.
		fireEvent.pointerLeave(button);
		fireEvent.pointerMove(button);
		fireEvent.keyDown(field, { key: "a" });
		expect(tip()).not.toBeNull();
	});

	it("does not come back when the focus returns to a control that was just used", () => {
		const button = renderTip();
		keyboardFocus(button, true);

		// The pointer pressed it (a menu opens); the menu closes and hands the focus back.
		fireEvent.pointerEnter(button);
		fireEvent.pointerDown(button);
		expect(tip()).toBeNull();
		fireEvent.focus(button);
		expect(tip()).toBeNull();

		// Once the focus has gone elsewhere, a keyboard focus shows it again.
		fireEvent.blur(button);
		fireEvent.focus(button);
		expect(tip()).not.toBeNull();
	});

	it("stays away while the menu the control opened is open, and after it hands the focus back", () => {
		render(
			<Tooltip label="Theme">
				<button
					type="button"
					aria-haspopup="menu"
					aria-expanded="false"
				>
					<span className="sr-only">Theme</span>
				</button>
			</Tooltip>,
		);
		const button = screen.getByRole("button", { name: "Theme" });
		keyboardFocus(button, true);
		const open = (is: boolean) =>
			button.setAttribute("aria-expanded", String(is));

		for (const opened of ["pointer", "Enter", " "] as const) {
			// It shows, the control is used, and its menu opens.
			if (opened === "pointer") {
				fireEvent.pointerEnter(button);
				fireEvent.pointerDown(button);
			} else {
				fireEvent.focus(button);
				fireEvent.keyDown(button, { key: opened });
			}
			expect(tip()).toBeNull();
			open(true);
			// The focus goes into the menu, and the pointer too.
			fireEvent.blur(button);
			fireEvent.pointerLeave(button);
			// Escape closes the menu, which gives the focus back to its button.
			open(false);
			fireEvent.focus(button);
			expect([opened, tip()]).toEqual([opened, null]);

			// Tab away and back: a new visit, and the name is shown again.
			fireEvent.blur(button);
			fireEvent.focus(button);
			expect([opened, tip() === null]).toEqual([opened, false]);
			fireEvent.blur(button);
		}

		// The pointer coming back after the menu closed is a new visit too.
		fireEvent.pointerEnter(button);
		fireEvent.pointerDown(button);
		open(true);
		fireEvent.pointerLeave(button);
		open(false);
		fireEvent.pointerEnter(button);
		expect(tip()).not.toBeNull();
	});

	it("takes its Escape listener off the page when it goes", () => {
		const added: string[] = [];
		const removed: string[] = [];
		const add = document.addEventListener.bind(document);
		const remove = document.removeEventListener.bind(document);
		document.addEventListener = ((type: string, ...rest: unknown[]) => {
			added.push(type);
			return (add as (...args: unknown[]) => void)(type, ...rest);
		}) as typeof document.addEventListener;
		document.removeEventListener = ((type: string, ...rest: unknown[]) => {
			removed.push(type);
			return (remove as (...args: unknown[]) => void)(type, ...rest);
		}) as typeof document.removeEventListener;
		try {
			const button = renderTip();
			const keys = (list: string[]) =>
				list.filter((type) => type === "keydown").length;
			const before = keys(added);

			fireEvent.pointerEnter(button);
			expect(keys(added) - before).toBe(1);
			fireEvent.pointerDown(button);
			expect(tip()).toBeNull();
			expect(keys(removed)).toBe(keys(added) - before);
		} finally {
			document.addEventListener = add;
			document.removeEventListener = remove;
		}
	});
});
