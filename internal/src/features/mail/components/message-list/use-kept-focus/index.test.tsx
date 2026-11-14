import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import {
	forgetListMemory,
	handFocusToList,
} from "@/features/mail/components/message-list/list-memory";
import {
	control,
	RowList as List,
} from "@/features/mail/test-support/row-list";

afterEach(() => {
	cleanup();
	forgetListMemory();
});

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

	it("does not follow a focus the person took to another control, also when that control is gone by then", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		const star = control("star b");
		const outside = control("outside");
		star.focus();
		// What a browser sends when the focus moves: where it went. The
		// other control then goes with its own part of the page, which
		// leaves the focus on the page: only what was heard here says that
		// the person had taken it away.
		fireEvent.focusOut(star, { relatedTarget: outside });
		star.blur();
		expect(document.activeElement).toBe(document.body);

		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(document.body);
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
	it("gives the focus to the row after one that had already left when it was handed over", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		// The list was read again and b went, with the focus in the reader.
		view.rerender(<List ids={["a", "c"]} />);
		expect(document.activeElement).toBe(document.body);

		// Only then does the reader hear that b left, and hands the focus over.
		handFocusToList("b");
		view.unmount();
		render(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("open c"));
	});

	it("comes back to the row that was opened last, also when its link could not take the focus", () => {
		const first = render(<List ids={["a", "b", "c"]} />);
		control("open a").focus();
		// `j` in the reader, with the list out of view: a click on the
		// link of the next row, and no focus.
		fireEvent.click(control("open b"));
		first.unmount();

		render(<List ids={["a", "b", "c"]} />);

		expect(document.activeElement).toBe(control("open b"));
	});

	it("forgets the rows of one list when another is drawn", () => {
		const view = render(<List ids={["a", "b", "c"]} address="inbox" />);
		control("star b").focus();
		view.unmount();

		// Another folder, which happens to hold a message of the same id.
		render(<List ids={["x", "b"]} address="archive" />);

		expect(document.activeElement).toBe(document.body);
	});
	it("gives up remembered row focus when another control takes it between drawings", () => {
		const first = render(<List ids={["a", "b"]} />);
		control("star b").focus();
		first.unmount();
		const button = document.createElement("button");
		document.body.append(button);
		button.focus();
		button.remove();

		render(<List ids={["a", "b"]} />);

		expect(document.activeElement).toBe(document.body);
	});

	it("keeps the reader's successor through several list updates before handoff", () => {
		const shown = render(<List ids={["a", "b", "c", "d", "x"]} />);
		control("outside").focus();
		shown.rerender(<List ids={["a", "c", "d", "x"]} />);
		shown.rerender(<List ids={["a", "d", "x"]} />);
		shown.rerender(<List ids={["a", "d"]} />);
		handFocusToList("b");
		shown.unmount();

		render(<List ids={["a", "d"]} />);

		expect(document.activeElement).toBe(control("open d"));
	});
});
