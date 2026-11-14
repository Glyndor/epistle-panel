import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Tooltip } from ".";
import {
	forgetInput,
	keyboardFocus,
	renderTip,
	tabTo,
	tip,
} from "./test-support";

afterEach(() => {
	forgetInput();
	cleanup();
});

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
			tabTo(button);
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

	it("shows for a pointer a tooltip uncovered, on its next move, and for no other move", () => {
		render(
			<>
				<Tooltip label="Actions for one">
					<button type="button">one</button>
				</Tooltip>
				<Tooltip label="Actions for two">
					<button type="button">two</button>
				</Tooltip>
			</>,
		);
		const one = screen.getByRole("button", { name: "one" });
		const two = screen.getByRole("button", { name: "two" });
		const found = document.elementsFromPoint;
		let under: Element[] = [];
		document.elementsFromPoint = () => under;
		const shown = () => tip()?.textContent ?? null;
		try {
			// A move on a control that nothing uncovered shows nothing: the
			// pointer coming in is what shows a tooltip.
			fireEvent.pointerMove(two);
			expect(shown()).toBeNull();

			// The tooltip of "one" lies over "two" and gives way to it. "two"
			// was never told the pointer came in: its next move shows its name.
			fireEvent.pointerEnter(one);
			under = [tip() as HTMLElement, two, document.body];
			fireEvent.pointerMove(tip() as HTMLElement);
			expect(shown()).toBeNull();
			fireEvent.pointerMove(two);
			expect(shown()).toBe("Actions for two");

			// A press sends it away, and moving on the control does not bring it back.
			fireEvent.pointerDown(two);
			expect(shown()).toBeNull();
			fireEvent.pointerMove(two);
			fireEvent.pointerMove(two);
			expect(shown()).toBeNull();
			// Leaving and coming back in does.
			fireEvent.pointerLeave(two);
			fireEvent.pointerEnter(two);
			expect(shown()).toBe("Actions for two");

			// Escape sends it away the same way.
			fireEvent.keyDown(document.body, { key: "Escape" });
			expect(shown()).toBeNull();
			fireEvent.pointerMove(two);
			expect(shown()).toBeNull();

			// Uncovered, and then a key or a press before the move: nothing.
			for (const before of [
				() => fireEvent.keyDown(document.body, { key: "a" }),
				() => fireEvent.pointerDown(document.body),
			]) {
				fireEvent.pointerLeave(two);
				fireEvent.pointerEnter(one);
				under = [tip() as HTMLElement, two, document.body];
				fireEvent.pointerMove(tip() as HTMLElement);
				before();
				fireEvent.pointerMove(two);
				expect(shown()).toBeNull();
			}

			// A finger moving on an uncovered control shows nothing.
			fireEvent.pointerEnter(one);
			under = [tip() as HTMLElement, two, document.body];
			fireEvent.pointerMove(tip() as HTMLElement);
			fireEvent.pointerMove(two, { pointerType: "touch" });
			expect(shown()).toBeNull();
		} finally {
			document.elementsFromPoint = found;
		}
	});

	it("does not come back under a pointer that stays, on a button that took the place of the one pressed", () => {
		// A menu that loads on demand swaps its button on the first press.
		const first = renderTip();
		fireEvent.pointerEnter(first);
		fireEvent.pointerDown(first);
		cleanup();

		const second = renderTip();
		fireEvent.keyDown(document.body, { key: "Escape" });
		fireEvent.pointerMove(second);
		fireEvent.pointerMove(second);

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
		fireEvent.pointerEnter(button);
		expect(tip()).not.toBeNull();
		fireEvent.keyDown(field, { key: "Escape" });
		expect(tip()).toBeNull();

		// Another key leaves it alone.
		fireEvent.pointerLeave(button);
		fireEvent.pointerEnter(button);
		fireEvent.keyDown(field, { key: "a" });
		expect(tip()).not.toBeNull();
	});

	it("does not come back when what the control opened hands the focus back, however it was opened and closed", () => {
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
		const open = (is: boolean) =>
			button.setAttribute("aria-expanded", String(is));
		const closings = [
			[
				"Escape",
				() => fireEvent.keyDown(document.body, { key: "Escape" }),
			],
			[
				"Enter on an option",
				() => fireEvent.keyDown(document.body, { key: "Enter" }),
			],
			[
				"a press on an option",
				() => fireEvent.pointerDown(document.body),
			],
		] as const;

		for (const opened of ["pointer", "Enter", " "] as const) {
			for (const [closed, close] of closings) {
				// It shows, the control is used, and its menu opens.
				if (opened === "pointer") {
					fireEvent.pointerEnter(button);
					fireEvent.pointerDown(button);
				} else {
					tabTo(button);
					expect(tip()).not.toBeNull();
					fireEvent.keyDown(button, { key: opened });
				}
				expect(tip()).toBeNull();
				open(true);
				// The focus goes into the menu, and the pointer too.
				fireEvent.blur(button);
				fireEvent.pointerLeave(button);
				// The menu closes and gives the focus back to its button.
				close();
				open(false);
				keyboardFocus(button, true);
				fireEvent.focus(button);
				expect([opened, closed, tip()]).toEqual([opened, closed, null]);

				// Tab away and back: a visit, and the name is shown again.
				fireEvent.blur(button);
				tabTo(button);
				expect([opened, closed, tip() === null]).toEqual([
					opened,
					closed,
					false,
				]);
				fireEvent.blur(button);
			}
		}
	});

	it("shows again for the keyboard after a menu was closed by a press outside, which hands no focus back", () => {
		const button = renderTip();

		fireEvent.pointerEnter(button);
		fireEvent.pointerDown(button);
		fireEvent.pointerLeave(button);
		// The press outside: the focus goes to the page, not to the button.
		fireEvent.pointerDown(document.body);
		expect(tip()).toBeNull();

		// The first visit with the keyboard after that names the control.
		tabTo(button);
		expect(tip()).toHaveTextContent("Toggle sidebar");
	});

	it("does not come back on a button that took the place of the one that was pressed", () => {
		// A menu that loads on demand swaps its button for another on the
		// first press: what the first one knew is gone with it.
		const first = renderTip();
		fireEvent.pointerEnter(first);
		fireEvent.pointerDown(first);
		cleanup();

		const second = renderTip();
		keyboardFocus(second, true);
		fireEvent.keyDown(document.body, { key: "Escape" });
		fireEvent.focus(second);

		expect(tip()).toBeNull();
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
