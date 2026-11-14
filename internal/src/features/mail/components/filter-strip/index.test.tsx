import { afterEach, describe, expect, it } from "bun:test";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";

import { FilterStrip } from ".";

afterEach(cleanup);

function strip() {
	const view = render(
		<FilterStrip label="Show">
			<li>
				<a href="#all">All</a>
			</li>
			<li>
				<a href="#unread">Unread</a>
			</li>
			<li>
				<a href="#files">With attachments</a>
			</li>
		</FilterStrip>,
	);
	const list = view.container.querySelector("ul");
	if (list === null) {
		throw new Error("no strip");
	}
	return { ...view, list };
}
/** Lay the strip out, which the test DOM does not: its width, its content's, and how far it is scrolled. */
function layOut(
	list: HTMLElement,
	box: { client: number; scroll: number; left: number },
) {
	Object.defineProperties(list, {
		clientWidth: { configurable: true, value: box.client },
		scrollWidth: { configurable: true, value: box.scroll },
		scrollLeft: { configurable: true, writable: true, value: box.left },
	});
	act(() => {
		fireEvent.scroll(list);
	});
}
const edges = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>("[data-edge]")).map((edge) =>
		edge.getAttribute("data-edge"),
	);

describe("FilterStrip", () => {
	it("is a named navigation with its filters on one line that scrolls sideways", () => {
		const { list } = strip();

		expect(
			screen.getByRole("navigation", { name: "Show" }),
		).toContainElement(list);
		expect(list).toHaveClass("flex", "overflow-x-auto");
		expect(list).not.toHaveClass("flex-wrap");
		// Room for a filter's ring inside the box that clips it, and for the
		// chevrons beside a filter brought into view (40 px, and 4 to spare).
		expect(list).toHaveClass("p-1", "-m-1", "scroll-px-11");
	});

	/** Make `:focus-visible` answer `visible` for `element`, which the test DOM does not compute. */
	function focusFrom(element: HTMLElement, visible: boolean) {
		const matches = element.matches.bind(element);
		element.matches = ((selector: string) =>
			selector === ":focus-visible"
				? visible
				: matches(selector)) as typeof element.matches;
	}

	it("brings a filter that takes the focus from a key into view, which a browser does not do for this box", () => {
		const { list } = strip();
		const asked: unknown[] = [];
		const last = screen.getByRole("link", { name: "With attachments" });
		last.scrollIntoView = (options?: unknown) => {
			asked.push(options);
		};
		focusFrom(last, true);

		fireEvent.focus(last);

		expect(asked).toEqual([{ block: "nearest", inline: "nearest" }]);
		expect(list.contains(last)).toBe(true);
	});

	it("leaves the strip where it is when a press gives the focus, so the press lands on the filter it began on", () => {
		strip();
		const asked: unknown[] = [];
		const last = screen.getByRole("link", { name: "With attachments" });
		last.scrollIntoView = (options?: unknown) => {
			asked.push(options);
		};
		focusFrom(last, false);

		fireEvent.focus(last);

		expect(asked).toEqual([]);
	});

	it("shows no chevron while every filter is in view", () => {
		const { container, list } = strip();

		layOut(list, { client: 300, scroll: 300, left: 0 });

		expect(edges(container)).toEqual([]);
	});

	it("says there is more for a single pixel out of view, at whichever end it is", () => {
		const { container, list } = strip();

		// Measured at 320 px in English: one pixel of the last filter.
		layOut(list, { client: 296, scroll: 297, left: 0 });
		expect(edges(container)).toEqual(["end"]);

		layOut(list, { client: 296, scroll: 297, left: 1 });
		expect(edges(container)).toEqual(["start"]);

		// Sizes come rounded: a fraction left over at the end is none.
		layOut(list, { client: 296, scroll: 342, left: 45.7 });
		expect(edges(container)).toEqual(["start"]);
	});

	it("shows a chevron at the end that holds more, and at both in between", () => {
		const { container, list } = strip();

		layOut(list, { client: 288, scroll: 334, left: 0 });
		expect(edges(container)).toEqual(["end"]);

		layOut(list, { client: 288, scroll: 334, left: 20 });
		expect(edges(container)).toEqual(["start", "end"]);

		layOut(list, { client: 288, scroll: 334, left: 46 });
		expect(edges(container)).toEqual(["start"]);

		// A right-to-left page counts the same distance the other way.
		layOut(list, { client: 288, scroll: 334, left: -46 });
		expect(edges(container)).toEqual(["start"]);
	});

	it("moves the strip toward the end a pointer presses, by most of what is in view", () => {
		const { container, list } = strip();
		const moved: Array<number | undefined> = [];
		list.scrollBy = ((options?: ScrollToOptions) => {
			moved.push(options?.left);
		}) as typeof list.scrollBy;
		layOut(list, { client: 200, scroll: 400, left: 100 });

		fireEvent.click(
			container.querySelector('[data-edge="end"]') as HTMLElement,
		);
		fireEvent.click(
			container.querySelector('[data-edge="start"]') as HTMLElement,
		);

		expect(moved).toEqual([150, -150]);
	});

	it("keeps the chevrons out of the tab order and of the accessibility tree: Tab reaches every filter", () => {
		const { container, list } = strip();
		layOut(list, { client: 200, scroll: 400, left: 100 });

		for (const edge of Array.from(
			container.querySelectorAll("[data-edge]"),
		)) {
			expect(edge).toHaveAttribute("tabindex", "-1");
			expect(edge).toHaveAttribute("aria-hidden", "true");
			// Over its end of the strip, on the pane's surface, with no line.
			expect(edge).toHaveClass("absolute", "inset-y-0", "from-surface");
			expect(edge.className).not.toMatch(/border|divide|shadow/);
		}
		// A press on one does not take the focus either.
		expect(
			fireEvent.mouseDown(
				container.querySelector("[data-edge]") as HTMLElement,
			),
		).toBe(false);
		expect(screen.getAllByRole("link")).toHaveLength(3);
		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(container.querySelector("[style]")).toBeNull();
	});
});
