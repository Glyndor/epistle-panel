import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { Calendar } from ".";

afterEach(() => {
	cleanup();
	document.documentElement.removeAttribute("dir");
});

const NOV = new Date(2026, 10, 15, 12);

function calendar(
	props: {
		selected?: Date;
		onSelect?: (next: Date | undefined) => void;
		startMonth?: Date;
		endMonth?: Date;
	} = {},
) {
	return (
		<Calendar
			mode="single"
			month={NOV}
			today={NOV}
			showOutsideDays={false}
			{...props}
		/>
	);
}

describe("Calendar", () => {
	it("draws a grid of the month's days with a heading for each weekday", () => {
		render(calendar());

		expect(screen.getByRole("grid")).toBeInTheDocument();
		const headings = document.querySelectorAll("th[scope=col]");
		expect(headings).toHaveLength(7);
		expect(headings[0]).toHaveAttribute("aria-label", "Sunday");
		expect(screen.getAllByRole("gridcell")).not.toHaveLength(0);
		expect(
			screen.getByRole("button", { name: /November 30th/ }),
		).toBeInTheDocument();
	});

	it("marks today with aria-current and the chosen day on its cell", () => {
		render(calendar({ selected: new Date(2026, 10, 10, 12) }));

		const today = screen.getByRole("button", { name: /November 15th/ });
		expect(today).toHaveAttribute("aria-current", "date");
		expect(
			screen.getByRole("button", { name: /November 10th/ }),
		).not.toHaveAttribute("aria-current");
		const cell = screen
			.getByRole("button", { name: /November 10th/ })
			.closest("td");
		expect(cell).toHaveAttribute("aria-selected", "true");
		expect(
			screen.getByRole("button", { name: /November 10th/ }),
		).toHaveAttribute("data-selected", "true");
		expect(
			screen.getByRole("button", { name: /November 11th/ }),
		).not.toHaveAttribute("data-selected");
	});

	it("tells the chosen day and today by more than a colour, in forced colours too", () => {
		render(calendar());
		const classes = screen.getByRole("button", {
			name: /November 15th/,
		}).className;

		expect(classes).toContain("data-[selected=true]:bg-primary");
		expect(classes).toContain(
			"forced-colors:data-[selected=true]:bg-[Highlight]",
		);
		expect(classes).toContain("aria-[current=date]:after:h-0.5");
		expect(classes).toContain("select-none");
	});

	it("is a 32 px target on a fine pointer and 44 px on a coarse one", () => {
		render(calendar());

		for (const name of [/November 15th/, /Previous|Go to the Previous/]) {
			expect(screen.getByRole("button", { name }).className).toMatch(
				/pointer-coarse:(h|size)-11/,
			);
		}
		expect(
			screen.getByRole("button", { name: /November 15th/ }).className,
		).toContain("h-8");
	});

	it("reports the day pressed, and the same day again as none", () => {
		const chosen: (Date | undefined)[] = [];
		const { rerender } = render(
			calendar({
				onSelect: (next) => chosen.push(next),
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: /November 10th/ }));
		expect(chosen[0]?.getDate()).toBe(10);

		rerender(
			calendar({
				selected: new Date(2026, 10, 10, 12),
				onSelect: (next) => chosen.push(next),
			}),
		);
		fireEvent.click(screen.getByRole("button", { name: /November 10th/ }));
		expect(chosen[1]).toBeUndefined();
	});

	it("moves the focus by day with the arrows and by month with Page Up and Page Down", () => {
		render(calendar());
		const start = screen.getByRole("button", { name: /November 10th/ });
		fireEvent.focus(start);

		fireEvent.keyDown(start, { key: "ArrowRight" });
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: /November 11th/ }),
		);
		fireEvent.keyDown(document.activeElement as Element, {
			key: "ArrowDown",
		});
		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: /November 18th/ }),
		);
	});

	it("reads the arrows the other way round on a page that reads from the right", () => {
		document.documentElement.dir = "rtl";
		render(calendar());
		const start = screen.getByRole("button", { name: /November 10th/ });
		fireEvent.focus(start);

		fireEvent.keyDown(start, { key: "ArrowRight" });

		expect(document.activeElement).toBe(
			screen.getByRole("button", { name: /November 9th/ }),
		);
		expect(document.querySelector(".rdp-root")).toHaveAttribute(
			"dir",
			"rtl",
		);
	});

	it("mirrors the month arrows when the page reads from the right", () => {
		render(calendar());

		for (const svg of document.querySelectorAll(".rdp-nav svg")) {
			expect(svg).toHaveClass("rtl:rotate-180");
			expect(svg).toHaveAttribute("aria-hidden", "true");
		}
	});

	it("stops the month at the ends it is given", () => {
		render(calendar({ endMonth: NOV, startMonth: NOV }));

		expect(screen.getByRole("button", { name: /Next/ })).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		expect(
			screen.getByRole("button", { name: /Previous/ }),
		).toHaveAttribute("aria-disabled", "true");
	});

	it("sends no style attribute and no style element in the page the server draws", () => {
		const html = renderToString(
			calendar({ selected: new Date(2026, 10, 10, 12) }),
		);

		expect(html).not.toMatch(/\sstyle=/);
		expect(html).not.toContain("<style");
	});
});
