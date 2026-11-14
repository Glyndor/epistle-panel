import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import {
	forgetListMemory,
	handFocusToList,
	listMemory,
} from "@/features/mail/components/message-list/list-memory";
import {
	control,
	RowList as List,
	scroller,
} from "@/features/mail/test-support/row-list";

const realFocus = HTMLElement.prototype.focus;
const realReveal = Element.prototype.scrollIntoView;
/** Every row brought into view, and how. */
let revealed: Array<[string | null, unknown]> = [];
/** How every focus was asked for. */
let focused: Array<FocusOptions | undefined> = [];

beforeEach(() => {
	revealed = [];
	focused = [];
	Element.prototype.scrollIntoView = function (options?: unknown) {
		revealed.push([
			this.querySelector("a")?.getAttribute("data-message-id") ?? null,
			options,
		]);
	};
	HTMLElement.prototype.focus = function (options?: FocusOptions) {
		focused.push(options);
		realFocus.call(this, options);
	};
});
afterEach(() => {
	Element.prototype.scrollIntoView = realReveal;
	HTMLElement.prototype.focus = realFocus;
	cleanup();
	forgetListMemory();
});

/** Scroll the list as a person does: the box moves and says so. */
function scrollTo(top: number) {
	scroller().scrollTop = top;
	fireEvent.scroll(scroller());
}

describe("rule 1: a list drawn anew stands where it stood", () => {
	it("puts the scroll of its address back", () => {
		const first = render(<List ids={["a", "b", "c"]} />);
		scrollTo(240);
		first.unmount();

		render(<List ids={["a", "b", "c"]} />);

		expect(scroller().scrollTop).toBe(240);
	});

	it("keeps the scroll of each address, and starts a list never seen at the top", () => {
		const view = render(<List ids={["a", "b"]} address="inbox" />);
		scrollTo(240);

		// A filter, in the same list pane.
		view.rerender(<List ids={["a"]} address="inbox unread" />);
		expect(scroller().scrollTop).toBe(0);
		scrollTo(80);
		view.rerender(<List ids={["a", "b"]} address="inbox" />);

		expect(scroller().scrollTop).toBe(240);
		expect(listMemory.scroll.get("inbox unread")).toBe(80);
	});

	it("does not take the scroll of a list on its way for the scroll of its address", () => {
		const view = render(<List ids={["a", "b"]} address="inbox" />);
		scrollTo(240);

		// The next page is asked for: the rows on screen are still the
		// previous page's, and so is whatever the box does meanwhile.
		view.rerender(
			<List ids={["a", "b"]} address="inbox 2" settled={false} />,
		);
		scrollTo(130);

		expect(listMemory.scroll.get("inbox 2")).toBeUndefined();
		expect(listMemory.scroll.get("inbox")).toBe(240);
		view.rerender(<List ids={["c", "d"]} address="inbox 2" />);
		expect(scroller().scrollTop).toBe(0);
	});

	it("leaves the scroll alone when the same list is read again", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		scrollTo(240);
		scroller().scrollTop = 250;

		view.rerender(<List ids={["a", "c"]} />);

		expect(scroller().scrollTop).toBe(250);
	});
});

describe("rule 2: putting the focus never moves the scroll", () => {
	it("asks for the focus without the scroll, for a row that left on its own and for one that left by a press", () => {
		const view = render(<List ids={["a", "b", "c", "d"]} />);
		control("open b").focus();
		focused = [];
		view.rerender(<List ids={["a", "c", "d"]} />);
		fireEvent.click(control("star c"));
		control("star c").focus();
		focused = [];
		view.rerender(<List ids={["a", "d"]} />);

		expect(document.activeElement).toBe(control("star d"));
		expect(focused).toEqual([{ preventScroll: true }]);
	});
});

describe("rule 3: the row the action concerns is brought into view", () => {
	it("brings the row that got the focus back into view when the list is drawn anew", () => {
		const first = render(<List ids={["a", "b", "c"]} />);
		control("open b").focus();
		first.unmount();

		render(<List ids={["a", "b", "c"]} />);

		expect(document.activeElement).toBe(control("open b"));
		expect(revealed).toEqual([["b", { block: "nearest" }]]);
	});

	it("reveals the focused row when its group is replaced within the current list", () => {
		const view = render(<List ids={["a", "b", "c"]} redrawn />);
		control("star c").focus();
		scrollTo(480);

		// A redraw replaces the control, even though its message stays.
		// The browser's focus call must not silently leave it below view.
		view.rerender(<List ids={["b", "c"]} redrawn />);

		expect(document.activeElement).toBe(control("star c"));
		expect(revealed).toEqual([["c", { block: "nearest" }]]);
	});

	it("restores and reveals focus when a group is replaced with the same message IDs", () => {
		const view = render(<List ids={["a", "b"]} />);
		const before = control("star b");
		before.focus();

		// A new date grouping can replace a run without changing its IDs.
		view.rerender(<List ids={["a", "b"]} redrawn />);

		expect(control("star b")).not.toBe(before);
		expect(document.activeElement).toBe(control("star b"));
		expect(revealed).toEqual([["b", { block: "nearest" }]]);
	});

	it("brings the row acted on into view when the list is drawn anew and the focus is elsewhere", () => {
		const first = render(<List ids={["a", "b", "c"]} />);
		// A press on a mark, with the focus left where it was.
		fireEvent.click(control("star c"));
		first.unmount();

		render(<List ids={["a", "b", "c"]} />);

		expect(document.activeElement).toBe(document.body);
		expect(revealed).toEqual([["c", { block: "nearest" }]]);
	});

	it("brings into view the row that takes the place of one that left by a press", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		control("star b").focus();
		fireEvent.click(control("star b"));

		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("star c"));
		expect(revealed).toEqual([["c", { block: "nearest" }]]);
	});

	it("reveals the replacement when a background update removes the focused row", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		control("open b").focus();

		// The list was read again in the background.
		view.rerender(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("open c"));
		expect(revealed).toEqual([["c", { block: "nearest" }]]);
	});

	it("brings nothing into view when the row acted on stays", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		control("star b").focus();
		fireEvent.click(control("star b"));

		view.rerender(<List ids={["b", "c"]} />);

		expect(revealed).toEqual([]);
	});

	it("keeps the action until its row leaves, not until the list is next drawn", () => {
		const view = render(<List ids={["a", "b", "c", "d"]} />);
		handFocusToList("c");
		// Drawn again with the row still there: the answer that takes it
		// away has not come yet.
		view.rerender(<List ids={["b", "c", "d"]} />);
		expect(document.activeElement).toBe(control("open c"));
		expect(revealed).toEqual([["c", { block: "nearest" }]]);
		revealed = [];

		view.rerender(<List ids={["b", "d"]} />);

		expect(document.activeElement).toBe(control("open d"));
		expect(revealed).toEqual([["d", { block: "nearest" }]]);
		expect(listMemory.acted).toBeNull();
	});

	it("ends the action with a press outside the list, and does not count a press in another row", () => {
		const view = render(<List ids={["a", "b", "c", "d"]} />);
		control("star b").focus();
		fireEvent.click(control("star a"));
		view.rerender(<List ids={["a", "c", "d"]} />);
		expect(document.activeElement).toBe(control("star c"));
		expect(revealed).toEqual([["c", { block: "nearest" }]]);

		fireEvent.click(control("star c"));
		fireEvent.pointerDown(control("outside"));
		expect(listMemory.acted).toBeNull();
		expect(listMemory.held).toBeNull();
	});
});

describe("rule 4: what could not happen is kept for the list drawn next", () => {
	it("keeps the focus for the row that would have had it while the list is not in view", () => {
		const view = render(<List ids={["a", "b", "c"]} />);
		handFocusToList("b");
		// The list is not in view: nothing in it can take the focus.
		HTMLElement.prototype.focus = () => {};
		view.rerender(<List ids={["a", "c"]} />);
		expect(document.activeElement).toBe(document.body);
		expect(listMemory.held).toEqual({ id: "c", mark: null });
		view.unmount();
		HTMLElement.prototype.focus = realFocus;

		// The page of the list, drawn anew and in view.
		render(<List ids={["a", "c"]} />);

		expect(document.activeElement).toBe(control("open c"));
		expect(revealed).toEqual([["c", { block: "nearest" }]]);
	});

	it("reads nothing while the list is on its way", () => {
		const first = render(<List ids={["a", "b", "c"]} />);
		control("star b").focus();
		scrollTo(240);
		first.unmount();

		const second = render(<List ids={[]} settled={false} />);
		expect(document.activeElement).toBe(document.body);
		expect(listMemory.held).toEqual({ id: "b", mark: "star" });
		second.rerender(<List ids={["a", "c"]} />);

		expect(scroller().scrollTop).toBe(240);
		expect(document.activeElement).toBe(control("star c"));
	});
});
