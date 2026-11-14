import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { handFocusToList, useKeptFocus } from ".";

afterEach(() => {
	// What the page remembers of the focus goes with a press on nothing.
	fireEvent.pointerDown(document.body);
	cleanup();
});

/** A list with the parts the hook looks for: rows, their link and their two marks. */
function List({
	ids,
	redrawn = false,
	settled = true,
}: {
	ids: readonly string[];
	/** Whether the list has its messages, or is still on its way. */
	settled?: boolean;
	/** Draw the rows again whenever the first one changes, as a group keyed by its first row did. */
	redrawn?: boolean;
}) {
	const focus = useKeptFocus(ids, settled);
	return (
		<>
			<div ref={focus.list}>
				<h2>Messages</h2>
				{ids.length === 0 ? (
					<div ref={focus.empty} tabIndex={-1}>
						nothing here
					</div>
				) : null}
				<ul key={redrawn ? ids[0] : "list"}>
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

	it("goes to the notice of the empty list when no row is left, not to a heading nobody sees", () => {
		const view = render(<List ids={["a"]} />);
		control("star a").focus();

		view.rerender(<List ids={[]} />);

		expect(document.activeElement).toBe(screen.getByText("nothing here"));
		expect(document.activeElement).not.toBe(
			screen.getByRole("heading", { name: "Messages" }),
		);
	});

	it("puts the focus back on a row that stayed but was drawn again", () => {
		const view = render(<List ids={["a", "b", "c"]} redrawn />);
		const before = control("star b");
		before.focus();

		// The first row leaves, the rows are drawn again: the button that had
		// the focus is gone and a new one stands for the same row.
		view.rerender(<List ids={["b", "c"]} redrawn />);

		expect(control("star b")).not.toBe(before);
		expect(document.activeElement).toBe(control("star b"));
	});

	it("leaves a row that was drawn again alone when the focus was not in the list", () => {
		const view = render(<List ids={["a", "b", "c"]} redrawn />);
		control("outside").focus();

		view.rerender(<List ids={["b", "c"]} redrawn />);

		expect(document.activeElement).toBe(control("outside"));
	});

	it("puts the focus back when the whole list is drawn anew, as when a message is opened or closed", () => {
		const first = render(<List ids={["a", "b", "c"]} />);
		control("star b").focus();

		// Another page of the same place: nothing of the first drawing is kept.
		first.unmount();
		expect(document.activeElement).toBe(document.body);
		render(<List ids={["b", "c"]} />);

		expect(document.activeElement).toBe(control("star b"));
	});

	it("waits for the new list to have its messages before it looks for the row", () => {
		const first = render(<List ids={["a", "b", "c"]} />);
		control("star b").focus();
		first.unmount();

		// Still on its way: no row yet, and that is not the row having left.
		const second = render(<List ids={[]} settled={false} />);
		expect(document.activeElement).toBe(document.body);
		second.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("star c"));
	});

	it("takes the focus from the reader at once, so the row leaving first does not find it elsewhere", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		// The reader's title, say: outside the list, and still in the page
		// when the list is read again.
		control("outside").focus();

		handFocusToList("b");
		expect(document.activeElement).toBe(document.body);
		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("open c"));
	});

	it("takes the focus for a message that leaves from the reader, on the row after it", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		expect(document.activeElement).toBe(document.body);

		// The reader had b open and the focus; b is archived from there.
		handFocusToList("b");
		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("open c"));
	});

	describe("the list's scroll", () => {
		const focus = HTMLElement.prototype.focus;
		let asked: Array<FocusOptions | undefined> = [];
		const watch = () => {
			asked = [];
			HTMLElement.prototype.focus = function (options?: FocusOptions) {
				asked.push(options);
				focus.call(this, options);
			};
		};
		afterEach(() => {
			HTMLElement.prototype.focus = focus;
		});

		it("does not follow the focus when the row left on its own", () => {
			const view = render(<List ids={["a", "b", "c"]} />);
			control("open b").focus();
			watch();

			// The list was read again in the background.
			view.rerender(<List ids={["a", "c"]} />);

			expect(document.activeElement).toBe(control("open c"));
			expect(asked).toEqual([{ preventScroll: true }]);
		});

		it("follows the focus when a press in the row made it leave", () => {
			const view = render(<List ids={["a", "b", "c"]} />);
			control("star b").focus();
			fireEvent.click(control("star b"));
			watch();

			view.rerender(<List ids={["a", "c"]} />);

			expect(document.activeElement).toBe(control("star c"));
			expect(asked).toEqual([{ preventScroll: false }]);
		});

		it("forgets a press once the list changed, and does not count one made in another row", () => {
			const view = render(<List ids={["a", "b", "c", "d"]} />);
			control("star c").focus();
			fireEvent.click(control("star c"));
			// The list changes for another reason, and c stays.
			view.rerender(<List ids={["b", "c", "d"]} />);
			expect(document.activeElement).toBe(control("star c"));
			watch();

			// Later c leaves on its own: the press is long past.
			view.rerender(<List ids={["b", "d"]} />);

			expect(document.activeElement).toBe(control("star d"));
			expect(asked).toEqual([{ preventScroll: true }]);
			cleanup();

			const other = render(<List ids={["a", "b", "c"]} />);
			control("star b").focus();
			fireEvent.click(control("star a"));
			watch();
			other.rerender(<List ids={["a", "c"]} />);

			expect(asked).toEqual([{ preventScroll: true }]);
		});
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
