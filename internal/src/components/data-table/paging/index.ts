/** The page sizes a table offers, and the one it starts with. */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

/** One of {@link PAGE_SIZES}. */
export type PageSize = (typeof PAGE_SIZES)[number];

/** Rows on a page until the viewer picks another size. */
export const DEFAULT_PAGE_SIZE: PageSize = 25;

/** Whether `value` is a size the table offers; anything else is not taken. */
export function isPageSize(value: number): value is PageSize {
	return (PAGE_SIZES as readonly number[]).includes(value);
}

/** Number of pages `count` rows take, never less than one. */
export function pageCountOf(count: number, pageSize: number): number {
	return Math.max(1, Math.ceil(count / pageSize));
}

/**
 * The page to show when `pageIndex` was asked for: itself, or the last page
 * that still has rows when the list got shorter under it.
 */
export function clampPageIndex(
	pageIndex: number,
	count: number,
	pageSize: number,
): number {
	return Math.min(Math.max(0, pageIndex), pageCountOf(count, pageSize) - 1);
}

/**
 * The first and the last row of a page, counted from 1, as the range text says
 * them. An empty list is `0` to `0`.
 */
export function pageRange(
	pageIndex: number,
	pageSize: number,
	count: number,
): { from: number; to: number } {
	if (count === 0) {
		return { from: 0, to: 0 };
	}
	const from = pageIndex * pageSize + 1;
	return { from, to: Math.min(count, from + pageSize - 1) };
}

/**
 * The page that holds, at the new size, the row that was first on screen, so
 * changing the size does not move the viewer to another part of the list.
 */
export function pageIndexForSize(
	pageIndex: number,
	pageSize: number,
	nextSize: number,
): number {
	return Math.floor((pageIndex * pageSize) / nextSize);
}

/** A page number, counted from 1, or a gap between two runs of them. */
export type PageItem = number | "gap-start" | "gap-end";

/** Page links shown at most: with more pages, gaps stand for the rest. */
const SLOTS = 7;

/**
 * The page links to draw around `current` (counted from 1): every page when
 * they fit, otherwise the first, the last and the ones around the current
 * page, always the same number of items so the row does not change width from
 * one page to the next.
 */
export function pageItems(current: number, pages: number): PageItem[] {
	if (pages <= SLOTS) {
		return Array.from({ length: pages }, (_, index) => index + 1);
	}
	if (current <= 4) {
		return [1, 2, 3, 4, 5, "gap-end", pages];
	}
	if (current >= pages - 3) {
		return [
			1,
			"gap-start",
			pages - 4,
			pages - 3,
			pages - 2,
			pages - 1,
			pages,
		];
	}
	return [
		1,
		"gap-start",
		current - 1,
		current,
		current + 1,
		"gap-end",
		pages,
	];
}
