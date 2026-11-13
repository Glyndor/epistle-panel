import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { buttonVariants } from "@/components/ui/button";

import {
	OutcomesCardSkeleton,
	QueueCardSkeleton,
	SuppressionCardSkeleton,
	TimelineCardSkeleton,
} from ".";

afterEach(cleanup);

const words = { title: "Queue by waiting time", action: "Queue" };
const legend = [
	{ key: "delivered", label: "Delivered", series: 0 },
	{ key: "failed", label: "Failed", series: 2 },
] as const;
const blocks = (container: HTMLElement) =>
	container.querySelectorAll('[data-slot="skeleton"]').length;
const place = (container: HTMLElement, text: string) =>
	Array.from(container.querySelectorAll('span[data-slot="skeleton"]')).find(
		(block) => block.textContent === text,
	);

describe("the chart card skeletons", () => {
	it("are marked busy and add no status line of their own", () => {
		render(<OutcomesCardSkeleton words={words} />);

		expect(screen.getByTestId("chart-skeleton")).toHaveAttribute(
			"aria-busy",
			"true",
		);
		// The page has one status line, in the counters' skeleton.
		expect(screen.queryByRole("status")).toBeNull();
	});

	it("show the title the card will have, as a heading of the same level", () => {
		render(<QueueCardSkeleton words={words} viewData="View data" />);

		// The words wrap where the card's will, in any language and width.
		expect(
			screen.getByRole("heading", {
				level: 3,
				name: "Queue by waiting time",
			}),
		).toHaveClass("font-medium", "text-sm");
	});

	it("hold the place of the link of the title row with its words, unseen, unread and not a link", () => {
		const { container } = render(
			<QueueCardSkeleton words={words} viewData="View data" />,
		);
		const link = place(container, "Queue");

		expect(link).toHaveAttribute("aria-hidden", "true");
		expect(link).toHaveClass("text-transparent", "select-none", "bg-muted");
		// Under the pointer it stays a block: the ghost button's own hover
		// would show the words.
		expect(link).toHaveClass("hover:text-transparent", "hover:bg-muted");
		expect(link).not.toHaveClass("hover:text-accent-foreground");
		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
		// Where `CardLink` puts the link: pulled into the card's corner.
		expect(link).toHaveClass("-me-2", "-mt-1");
	});

	it("give a place the measures of the button it stands for, 44 px under a finger", () => {
		const { container } = render(
			<QueueCardSkeleton words={words} viewData="View data" />,
		);
		const sizes = buttonVariants({ variant: "outline", size: "sm" })
			.split(" ")
			.filter((name) => /^(pointer-coarse:)?(min-[hw]|px)-/.test(name));

		// The sizes of the small button, the 44 px of a coarse pointer among
		// them, taken from the button and not written again here.
		expect(sizes).toContain("min-h-6");
		expect(sizes).toContain("pointer-coarse:min-h-11");
		for (const text of ["Queue", "View data"]) {
			expect(place(container, text)).toHaveClass(...sizes);
		}
		expect(place(container, "View data")).toHaveClass("self-start");
	});

	it("draw the parts the outcomes card has, the table flush with the bottom in rows of the table's height", () => {
		const { container } = render(<OutcomesCardSkeleton words={words} />);

		// The line under the title, the link, the figure, the thin bar and the
		// six rows of the table.
		expect(blocks(container)).toBe(10);
		expect(container.querySelector(".rounded-full")).not.toBeNull();
		const table = container.querySelector(".-mb-4");
		const heights = Array.from(table?.children ?? []).map((row) =>
			Array.from(row.classList).filter((name) => /(^|:)h-/.test(name)),
		);
		// A header and five outcomes; 44 px each under a finger.
		expect(heights).toEqual([
			["pointer-coarse:h-11", "h-8"],
			...Array.from({ length: 5 }, () => ["pointer-coarse:h-11", "h-9"]),
		]);
	});

	it("draw the legend of the timeline as it will be, then the plot at its 180 px and the button", () => {
		const { container } = render(
			<TimelineCardSkeleton
				words={words}
				note="Per hour, UTC · read at 00:00"
				legend={legend}
				viewData="View data"
			/>,
		);
		const names = container.querySelector('[data-slot="chart-legend"]');

		expect(
			Array.from(names?.children ?? []).map((item) => item.textContent),
		).toEqual(["Delivered", "Failed"]);
		expect(container.querySelector(".h-45")).not.toBeNull();
		expect(place(container, "View data")).toBeDefined();
		// The line under the title, the link, the plot and the button.
		expect(blocks(container)).toBe(4);
	});

	it("hold the place of the timeline's line with its own words, so it wraps as the card's will", () => {
		const { container } = render(
			<TimelineCardSkeleton
				words={words}
				note="Per hour, UTC · read at 00:00"
				legend={legend}
				viewData="View data"
			/>,
		);
		const line = container.querySelector('p[data-slot="skeleton"]');

		expect(line).toHaveTextContent("Per hour, UTC · read at 00:00");
		// The size of the card's line, unseen and unread.
		expect(line).toHaveClass("text-xs", "text-transparent", "select-none");
		expect(line).toHaveAttribute("aria-hidden", "true");
		expect(line).toHaveClass("w-fit", "max-w-full");
		// And no bar of a fixed height beside it.
		expect(container.querySelector(".h-4.w-28")).toBeNull();
	});

	it("draw four rows of a name over a bar for the queue and six for the suppression list", () => {
		const queue = render(
			<QueueCardSkeleton words={words} viewData="View data" />,
		);
		const bars = (container: HTMLElement) =>
			container.querySelectorAll(".h-2.rounded-full").length;
		expect(bars(queue.container)).toBe(4);
		// The queue card has a line under its title; the other has none.
		expect(queue.container.querySelector(".h-4.w-28")).not.toBeNull();
		queue.unmount();

		const suppression = render(
			<SuppressionCardSkeleton words={words} viewData="View data" />,
		);
		// Five domains and one row for the rest.
		expect(bars(suppression.container)).toBe(6);
		expect(suppression.container.querySelector(".h-4.w-28")).toBeNull();
		// A row is a name of 20 px over a bar of 8, 4 apart, and rows 10 apart.
		const list = suppression.container.querySelector(".gap-2\\.5");
		expect(list?.children).toHaveLength(6);
		expect(list?.firstElementChild).toHaveClass("flex-col", "gap-1");
		expect(list?.firstElementChild?.firstElementChild).toHaveClass("h-5");
	});

	it("take the grid class of the card they stand for", () => {
		render(
			<TimelineCardSkeleton
				words={words}
				note="Per hour, UTC · read at 00:00"
				legend={legend}
				viewData="View data"
				className="@3xl:col-span-3"
			/>,
		);

		expect(screen.getByTestId("chart-skeleton")).toHaveClass(
			"@3xl:col-span-3",
		);
	});

	it("do not pulse and carry no style attribute", () => {
		const { container } = render(
			<QueueCardSkeleton words={words} viewData="View data" />,
		);

		expect(container.innerHTML).not.toMatch(/animate-/);
		expect(container.querySelector("[style]")).toBeNull();
	});
});
