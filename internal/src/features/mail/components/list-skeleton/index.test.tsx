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

	it("holds the place of a date heading and of six rows", () => {
		const { container } = render(<ListSkeleton />);

		expect(
			container.querySelectorAll('[data-slot="row-skeleton"]'),
		).toHaveLength(6);
		expect(container.querySelector(".h-8")).not.toBeNull();
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

	it("draws the initials as a circle and the lines beside it, and the preview only when comfortable", () => {
		const { container } = render(<ListSkeleton />);
		const place = container.querySelector('[data-slot="row-skeleton"]');
		const [circle, ...lines] = Array.from(place?.children ?? []);

		expect(circle).toHaveClass(
			"rounded-full",
			"size-8",
			"group-data-[density=compact]/list:size-6",
		);
		expect(lines).toHaveLength(3);
		expect(lines[2]).toHaveClass(
			"group-data-[density=compact]/list:hidden",
		);
		expect(place).toHaveClass("ps-5", "pe-3");
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
});
