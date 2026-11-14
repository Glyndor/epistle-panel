import { fireEvent, render, screen } from "@testing-library/react";

import { Tooltip } from "..";

/** What the tests of the tooltip share: the one on the page, a control given a rectangle, and a control with a tooltip. */
export const tip = () =>
	document.querySelector<HTMLElement>("[data-slot='tooltip']");

/** Give the control a rectangle, which happy-dom does not lay out. */
export function place(element: HTMLElement, box: Partial<DOMRect>) {
	element.getBoundingClientRect = () =>
		({
			top: 0,
			left: 0,
			right: 0,
			bottom: 0,
			width: 0,
			height: 0,
			x: 0,
			y: 0,
			toJSON: () => ({}),
			...box,
		}) as DOMRect;
}

/** Say whether the control's focus is a keyboard one. */
export function keyboardFocus(element: HTMLElement, visible: boolean) {
	const original = element.matches.bind(element);
	element.matches = ((selector: string) =>
		selector === ":focus-visible"
			? visible
			: original(selector)) as typeof element.matches;
}

/** Move the focus to the control the way the Tab key does: the key, then the focus. */
export function tabTo(element: HTMLElement) {
	keyboardFocus(element, true);
	fireEvent.keyDown(document.body, { key: "Tab" });
	fireEvent.focus(element);
}

export function renderTip(props: Partial<Parameters<typeof Tooltip>[0]> = {}) {
	render(
		<Tooltip label="Toggle sidebar" {...props}>
			<button type="button">
				<span className="sr-only">Toggle sidebar</span>
			</button>
		</Tooltip>,
	);
	return screen.getByRole("button", { name: "Toggle sidebar" });
}
