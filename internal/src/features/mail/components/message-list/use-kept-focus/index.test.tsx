import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { useKeptFocus } from ".";

afterEach(cleanup);

/** A list with the parts the hook looks for: rows, their link and their two marks. */
function List({ ids }: { ids: readonly string[] }) {
	const focus = useKeptFocus(ids);
	return (
		<>
			<div ref={focus.list}>
				<h2 ref={focus.heading} tabIndex={-1}>
					Messages
				</h2>
				<ul>
					{ids.map((id) => (
						<li key={id} data-slot="message-row">
							<a href={`#${id}`} data-message-id={id}>
								open {id}
							</a>
							<button type="button" data-mark="important">
								important {id}
							</button>
							<button type="button" data-mark="star">
								star {id}
							</button>
						</li>
					))}
				</ul>
			</div>
			<button type="button">outside</button>
		</>
	);
}
const control = (name: string) =>
	screen.getByRole(name.startsWith("open") ? "link" : "button", { name });

describe("useKeptFocus", () => {
	it("moves the focus to the same button of the row that came after the one that left", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		control("star b").focus();

		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("star c"));
	});

	it("goes to the row before when the last one left", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		control("important c").focus();

		view.rerender(<List ids={["a", "b"]} />);

		expect(document.activeElement).toBe(control("important b"));
	});

	it("goes to the list's heading when no row is left", () => {
		const view = render(<List ids={["a"]} />);
		control("star a").focus();

		view.rerender(<List ids={[]} />);

		expect(document.activeElement).toBe(
			screen.getByRole("heading", { name: "Messages" }),
		);
	});

	it("keeps to the link when the link had the focus", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		control("open b").focus();

		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("open c"));
	});

	it("skips rows that left with it", () => {
		const view = render(<List ids={["a", "b", "c", "d"]} />);
		control("star b").focus();

		view.rerender(<List ids={["a", "d"]} />);

		expect(document.activeElement).toBe(control("star d"));
	});

	it("leaves the focus alone when the row is still there", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		control("star b").focus();

		view.rerender(<List ids={["b", "c"]} />);

		expect(document.activeElement).toBe(control("star b"));
	});

	it("does not follow a focus the person took to another control", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		const star = control("star b");
		const outside = control("outside");
		star.focus();
		outside.focus();
		// What a browser sends with it: where the focus went.
		fireEvent.focusOut(star, { relatedTarget: outside });

		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(outside);
	});

	it("does not pull back a focus that was taken elsewhere and then dropped", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		const star = control("star b");
		const outside = control("outside");
		star.focus();
		outside.focus();
		fireEvent.focusOut(star, { relatedTarget: outside });
		// The other control lets go of it: the focus is on the page again.
		outside.blur();

		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).not.toBe(control("star c"));
		expect(document.activeElement?.closest("ul")).toBeNull();
	});

	it("does not pull the focus back after a press outside the row", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		const star = control("star b");
		star.focus();
		fireEvent.pointerDown(document.body);
		star.blur();

		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).not.toBe(control("star c"));
		expect(document.activeElement).not.toBe(control("star a"));
	});

	it("moves nothing when the focus was never in the list", () => {
		const view = render(<List ids={["a", "b"]} />);

		view.rerender(<List ids={["a"]} />);

		expect(document.activeElement).toBe(document.body);
	});
});
