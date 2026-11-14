import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { withQuery } from "@/test/query-wrapper";
import { summary } from "../../test-support/fixtures";
import { MessageRow } from "../message-row";

import { ListPaneSkeleton, ListSkeleton } from ".";

afterEach(cleanup);

/** The classes of `element` that set its height or its side margins, at any variant. */
const box = (element: Element | null) =>
	(element?.className ?? "")
		.split(/\s+/)
		.filter((name) => /(^|:)(h|ps|pe)-[\w./]+$/.test(name))
		.sort();

describe("ListSkeleton", () => {
	it("says once that the messages are loading", () => {
		const { container } = render(<ListSkeleton />);

		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(screen.getByRole("status")).toHaveTextContent("loading");
		expect(container.firstElementChild).toHaveAttribute(
			"aria-busy",
			"true",
		);
	});

	it("holds the place of a date heading and of six rows, the heading right on its rows as in the list", () => {
		const { container } = render(<ListSkeleton />);
		const frame = container.firstElementChild;
		const heading = container.querySelector(".h-8");
		const rows = heading?.nextElementSibling;

		expect(
			container.querySelectorAll('[data-slot="row-skeleton"]'),
		).toHaveLength(6);
		// A gap between the heading and the rows moved the first message by its size.
		expect(frame?.className).not.toMatch(/(^|\s)(gap|space-y)-/);
		expect(rows).toHaveClass("flex", "flex-col", "gap-1");
		expect(rows?.children).toHaveLength(6);
	});

	it("gives a row's place the height of a real row in both densities and on both pointers", () => {
		const { container } = render(<ListSkeleton />);
		const place = container.querySelector('[data-slot="row-skeleton"]');
		const heights = box(place).filter((name) => /(^|:)h-/.test(name));
		cleanup();
		const real = render(
			withQuery(
				<ul>
					<MessageRow
						message={summary()}
						selected={false}
						view={{
							box: "INBOX",
							role: "inbox",
							page: 1,
							filter: "all",
							q: "",
						}}
						datePart="time"
					/>
				</ul>,
			),
		).container.querySelector("li");

		expect(heights).toEqual([
			"group-data-[density=compact]/list:h-10",
			"h-18",
			"pointer-coarse:group-data-[density=compact]/list:h-11",
		]);
		expect(heights).toEqual(
			box(real).filter((name) => /(^|:)h-/.test(name)),
		);
	});

	it("draws the initials as a circle where the row has them, the lines beside it, and the preview only when comfortable", () => {
		const { container } = render(<ListSkeleton />);
		const place = container.querySelector('[data-slot="row-skeleton"]');
		const [circle, ...lines] = Array.from(place?.children ?? []);
		const C = "group-data-[density=compact]/list:";

		expect(circle).toHaveClass(
			"rounded-full",
			"size-8",
			"hidden",
			"@xs/row:block",
			`${C}size-6`,
			`${C}hidden`,
			`${C}@sm/row:block`,
		);
		expect(lines).toHaveLength(3);
		expect(lines[2]).toHaveClass(`${C}hidden`);
		expect(place).toHaveClass(
			"@container/row",
			"ps-5",
			"pe-3",
			`${C}pe-15`,
		);
	});

	it("never moves: no animation and no style attribute", () => {
		const { container } = render(<ListSkeleton />);

		expect(container.innerHTML).not.toMatch(/animate-|transition/);
		expect(container.querySelector("[style]")).toBeNull();
	});
});

describe("ListPaneSkeleton", () => {
	it("holds the place of the toolbar, hidden, and scrolls the list like the real pane", () => {
		const { container } = render(<ListPaneSkeleton />);
		const [toolbar, list] = Array.from(container.children);

		expect(toolbar).toHaveAttribute("aria-hidden", "true");
		expect(list).toHaveClass("overflow-y-auto", "scroll-pt-8");
		expect(list?.querySelector('[aria-busy="true"]')).not.toBeNull();
	});

	it("holds two bars as tall as the search field and the filters, on both pointers", () => {
		const { container } = render(<ListPaneSkeleton />);
		const bars = Array.from(container.firstElementChild?.children ?? []);

		expect(bars).toHaveLength(2);
		for (const bar of bars) {
			expect(bar).toHaveClass("h-8", "pointer-coarse:h-11");
		}
		expect(container.firstElementChild).toHaveClass("gap-2", "p-2");
	});
});
