import { describe, expect, it } from "bun:test";

import {
	clampPageIndex,
	DEFAULT_PAGE_SIZE,
	isPageSize,
	PAGE_SIZES,
	pageCountOf,
	pageIndexForSize,
	pageItems,
	pageRange,
} from ".";

describe("page sizes", () => {
	it("offers 10, 25, 50 and 100 rows, and starts with 25", () => {
		expect([...PAGE_SIZES]).toEqual([10, 25, 50, 100]);
		expect(DEFAULT_PAGE_SIZE).toBe(25);
	});

	it("takes only a size it offers", () => {
		expect(isPageSize(10)).toBe(true);
		expect(isPageSize(100)).toBe(true);
		for (const other of [
			0,
			1,
			11,
			24,
			26,
			101,
			1000,
			-25,
			2.5,
			Number.NaN,
		]) {
			expect([other, isPageSize(other)]).toEqual([other, false]);
		}
	});
});

describe("pageCountOf", () => {
	it("counts the pages the rows take, and one for an empty list", () => {
		expect(pageCountOf(0, 25)).toBe(1);
		expect(pageCountOf(1, 25)).toBe(1);
		expect(pageCountOf(25, 25)).toBe(1);
		expect(pageCountOf(26, 25)).toBe(2);
		expect(pageCountOf(132, 25)).toBe(6);
		expect(pageCountOf(100, 10)).toBe(10);
	});
});

describe("clampPageIndex", () => {
	it("keeps a page that still has rows", () => {
		expect(clampPageIndex(0, 60, 25)).toBe(0);
		expect(clampPageIndex(2, 60, 25)).toBe(2);
		expect(clampPageIndex(1, 26, 25)).toBe(1);
	});

	it("steps back to the last page with rows when the list is shorter", () => {
		expect(clampPageIndex(2, 50, 25)).toBe(1);
		expect(clampPageIndex(2, 30, 25)).toBe(1);
		expect(clampPageIndex(5, 5, 25)).toBe(0);
		expect(clampPageIndex(3, 0, 25)).toBe(0);
	});

	it("never goes before the first page", () => {
		expect(clampPageIndex(-1, 60, 25)).toBe(0);
	});
});

describe("pageRange", () => {
	it("says the first and last row of the page, counted from 1", () => {
		expect(pageRange(0, 25, 132)).toEqual({ from: 1, to: 25 });
		expect(pageRange(1, 25, 132)).toEqual({ from: 26, to: 50 });
		expect(pageRange(5, 25, 132)).toEqual({ from: 126, to: 132 });
		expect(pageRange(0, 10, 3)).toEqual({ from: 1, to: 3 });
		expect(pageRange(2, 10, 30)).toEqual({ from: 21, to: 30 });
	});

	it("is 0 to 0 for an empty list", () => {
		expect(pageRange(0, 25, 0)).toEqual({ from: 0, to: 0 });
	});
});

describe("pageIndexForSize", () => {
	it("finds the page that holds the row that was first on screen", () => {
		// Row 26 leads page 2 of 25: with 10 a page it is on the third.
		expect(pageIndexForSize(1, 25, 10)).toBe(2);
		// Row 21 leads page 3 of 10: with 25 a page it is on the first.
		expect(pageIndexForSize(2, 10, 25)).toBe(0);
		expect(pageIndexForSize(0, 25, 100)).toBe(0);
		expect(pageIndexForSize(3, 25, 50)).toBe(1);
		expect(pageIndexForSize(1, 50, 10)).toBe(5);
	});
});

describe("pageItems", () => {
	it("lists every page when they fit", () => {
		expect(pageItems(1, 1)).toEqual([1]);
		expect(pageItems(2, 3)).toEqual([1, 2, 3]);
		expect(pageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it("leaves a gap before the last page while the current one is near the start", () => {
		expect(pageItems(1, 20)).toEqual([1, 2, 3, 4, 5, "gap-end", 20]);
		expect(pageItems(4, 20)).toEqual([1, 2, 3, 4, 5, "gap-end", 20]);
	});

	it("leaves a gap on both sides in the middle", () => {
		expect(pageItems(5, 20)).toEqual([
			1,
			"gap-start",
			4,
			5,
			6,
			"gap-end",
			20,
		]);
		expect(pageItems(16, 20)).toEqual([
			1,
			"gap-start",
			15,
			16,
			17,
			"gap-end",
			20,
		]);
	});

	it("leaves a gap after the first page while the current one is near the end", () => {
		expect(pageItems(17, 20)).toEqual([1, "gap-start", 16, 17, 18, 19, 20]);
		expect(pageItems(20, 20)).toEqual([1, "gap-start", 16, 17, 18, 19, 20]);
	});

	it("always holds the current, the first and the last page, in 7 items once there are gaps", () => {
		for (let pages = 8; pages <= 40; pages++) {
			for (let current = 1; current <= pages; current++) {
				const items = pageItems(current, pages);
				expect(items).toHaveLength(7);
				expect(items).toContain(current);
				expect(items.at(0)).toBe(1);
				expect(items.at(-1)).toBe(pages);
				const numbers = items.filter(
					(item) => typeof item === "number",
				);
				expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
				expect(new Set(items).size).toBe(7);
			}
		}
	});
});
