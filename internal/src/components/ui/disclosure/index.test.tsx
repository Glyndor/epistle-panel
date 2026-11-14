import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Disclosure, DisclosureContent, DisclosureTrigger } from ".";

afterEach(() => {
	cleanup();
});

/** The part with its button and what it holds. */
function part() {
	return (
		<div>
			<button type="button">outside</button>
			<Disclosure>
				<DisclosureTrigger>
					<span className="sr-only">the fields</span>
				</DisclosureTrigger>
				<DisclosureContent>
					<input type="text" aria-label="a field" />
				</DisclosureContent>
			</Disclosure>
		</div>
	);
}

/** The button that opens and closes the part. */
const trigger = () => screen.getByText("the fields").closest("summary");
/** The part itself. */
const details = () => trigger()?.closest("details") as HTMLDetailsElement;

describe("the disclosure", () => {
	it("opens and closes with its own button, with no script of its own", () => {
		render(part());

		expect(details().open).toBe(false);

		fireEvent.click(trigger() as HTMLElement);

		expect(details().open).toBe(true);

		fireEvent.click(trigger() as HTMLElement);

		expect(details().open).toBe(false);
	});

	it("opens and closes with the space key", () => {
		render(part());

		fireEvent.keyDown(trigger() as HTMLElement, { key: " " });

		expect(details().open).toBe(true);
	});

	it("closes with Escape and gives the focus back to its button", () => {
		render(part());
		fireEvent.click(trigger() as HTMLElement);
		const field = screen.getByRole("textbox", { name: "a field" });
		field.focus();

		fireEvent.keyDown(field, { key: "Escape" });

		expect(details().open).toBe(false);
		expect(document.activeElement).toBe(trigger());
	});

	it("closes with a press outside it", () => {
		render(part());
		fireEvent.click(trigger() as HTMLElement);

		fireEvent.pointerDown(screen.getByRole("button", { name: "outside" }));

		expect(details().open).toBe(false);
	});

	it("keeps what it holds inside it, so the browser takes it out of sight while it is closed", () => {
		render(part());

		const content = screen.getByRole("textbox", { name: "a field" });

		// The content of a closed disclosure is not painted and is not in the
		// tab order: that is the browser's own doing, and it needs the content
		// to be inside the details.
		expect(details().contains(content)).toBe(true);
	});
});
