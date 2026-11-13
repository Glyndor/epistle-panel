import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { PageSize } from "@/components/data-table/paging";

import { DataTablePagination } from ".";

afterEach(cleanup);

function setup(
	over: { pageIndex?: number; pageSize?: PageSize; count?: number } = {},
) {
	const onPageChange = mock((_pageIndex: number) => {});
	const onPageSizeChange = mock((_pageSize: PageSize) => {});
	const view = render(
		<DataTablePagination
			pageIndex={over.pageIndex ?? 0}
			pageSize={over.pageSize ?? 25}
			count={over.count ?? 132}
			onPageChange={onPageChange}
			onPageSizeChange={onPageSizeChange}
		/>,
	);
	return { ...view, onPageChange, onPageSizeChange };
}
const numbers = () =>
	screen
		.getAllByRole("button", { name: "page" })
		.map((button) => button.textContent);

describe("DataTablePagination", () => {
	it("shows the range, and leaves saying it to the table's announcer", () => {
		setup();

		const range = screen.getByText("range");
		expect(range).not.toHaveAttribute("aria-live");
		expect(range).not.toHaveClass("sr-only");
	});

	it("names its controls: a pages landmark, previous, next and a labelled size", () => {
		setup();

		expect(
			screen.getByRole("navigation", { name: "pagination" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "previous" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("button", { name: "next" }),
		).toBeInTheDocument();
		expect(screen.getByRole("combobox", { name: "pageSize" }).tagName).toBe(
			"SELECT",
		);
	});

	it("offers 10, 25, 50 and 100 rows a page, with the current one chosen", () => {
		setup({ pageSize: 50 });
		const size = screen.getByRole("combobox", { name: "pageSize" });

		expect(
			[...size.querySelectorAll("option")].map((option) => option.value),
		).toEqual(["10", "25", "50", "100"]);
		expect(size).toHaveValue("50");
	});

	it("reports another size, and ignores a value it does not offer", () => {
		const { onPageSizeChange } = setup();
		const size = screen.getByRole("combobox", { name: "pageSize" });

		fireEvent.change(size, { target: { value: "100" } });
		expect(onPageSizeChange).toHaveBeenCalledWith(100);

		// A value put in the page by hand: the select holds only the four, so
		// an option is added the way an edited page would have it.
		const forged = document.createElement("option");
		forged.value = "5000";
		size.append(forged);
		fireEvent.change(size, { target: { value: "5000" } });
		expect(onPageSizeChange).toHaveBeenCalledTimes(1);
	});

	it("goes one page back and one on from the page it is on", () => {
		const { onPageChange } = setup({ pageIndex: 2 });

		fireEvent.click(screen.getByRole("button", { name: "previous" }));
		expect(onPageChange).toHaveBeenLastCalledWith(1);
		fireEvent.click(screen.getByRole("button", { name: "next" }));
		expect(onPageChange).toHaveBeenLastCalledWith(3);
	});

	it("has nowhere to go back to on the first page, nor on from the last", () => {
		const first = setup({ pageIndex: 0 });
		expect(
			screen.getByRole("button", { name: "previous" }),
		).toHaveAttribute("aria-disabled", "true");
		expect(
			screen.getByRole("button", { name: "next" }),
		).not.toHaveAttribute("aria-disabled");
		fireEvent.click(screen.getByRole("button", { name: "previous" }));
		expect(first.onPageChange).not.toHaveBeenCalled();
		cleanup();

		// 132 rows at 25 a page: the sixth page is the last.
		const last = setup({ pageIndex: 5 });
		expect(screen.getByRole("button", { name: "next" })).toHaveAttribute(
			"aria-disabled",
			"true",
		);
		expect(
			screen.getByRole("button", { name: "previous" }),
		).not.toHaveAttribute("aria-disabled");
		fireEvent.click(screen.getByRole("button", { name: "next" }));
		expect(last.onPageChange).not.toHaveBeenCalled();
	});

	it("lists the page numbers, marks the current one and goes to the one pressed", () => {
		const { onPageChange } = setup({ pageIndex: 1 });

		expect(numbers()).toEqual(["1", "2", "3", "4", "5", "6"]);
		expect(
			screen.getByRole("button", { current: "page" }).textContent,
		).toBe("2");

		fireEvent.click(
			screen.getAllByRole("button", { name: "page" })[4] as HTMLElement,
		);
		expect(onPageChange).toHaveBeenCalledWith(4);
	});

	it("stands a gap for the pages it leaves out, hidden from a screen reader", () => {
		const { container } = setup({ pageIndex: 9, pageSize: 10, count: 400 });

		expect(numbers()).toEqual(["1", "9", "10", "11", "40"]);
		const gaps = container.querySelectorAll(
			'[data-slot="pagination-ellipsis"]',
		);
		expect(gaps).toHaveLength(2);
		for (const gap of gaps) {
			expect(gap.closest("li")).toHaveAttribute("aria-hidden", "true");
		}
	});

	it("shows the numbers only once the foot is wide enough, and the page-of text below that", () => {
		const { container } = setup({ pageIndex: 1 });

		expect(container.firstElementChild).toHaveClass("@container");
		const pageOf = screen.getByText("pageOf");
		expect(pageOf).toHaveClass("@md:hidden");
		for (const button of screen.getAllByRole("button", { name: "page" })) {
			expect(button.closest("li")).toHaveClass("hidden", "@md:block");
		}
		// Previous and next are there at every width.
		for (const name of ["previous", "next"]) {
			expect(
				screen.getByRole("button", { name }).closest("li"),
			).not.toHaveClass("hidden");
		}
	});

	it("has no page controls for a list that fits one page, and keeps the range and the size", () => {
		// 25 rows at 25 a page: one page.
		setup({ count: 25 });

		expect(screen.queryByRole("navigation")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText("range")).toBeInTheDocument();
		expect(
			screen.getByRole("combobox", { name: "pageSize" }),
		).toBeInTheDocument();
	});

	it("has them from the 26th row on", () => {
		setup({ count: 26 });

		expect(
			screen.getByRole("navigation", { name: "pagination" }),
		).toBeInTheDocument();
		expect(
			screen
				.getAllByRole("button", { name: "page" })
				.map((b) => b.textContent),
		).toEqual(["1", "2"]);
	});

	it("carries no inline style", () => {
		const { container } = setup({ pageIndex: 9, pageSize: 10, count: 400 });

		expect(container.querySelector("[style]")).toBeNull();
	});
});
