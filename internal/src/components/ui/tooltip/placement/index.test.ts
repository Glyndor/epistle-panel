import { afterEach, describe, expect, it } from "bun:test";

import { hasPopupOpen, placeOf, samePlace } from ".";

const box = (over: Partial<DOMRect>): DOMRect =>
	({
		top: 100,
		bottom: 132,
		left: 50,
		right: 90,
		width: 40,
		height: 32,
		x: 50,
		y: 100,
		toJSON: () => ({}),
		...over,
	}) as DOMRect;

const view = (width: number, height: number) => {
	Object.defineProperty(document.documentElement, "clientWidth", {
		configurable: true,
		value: width,
	});
	Object.defineProperty(document.documentElement, "clientHeight", {
		configurable: true,
		value: height,
	});
};

afterEach(() => {
	Reflect.deleteProperty(document.documentElement, "clientWidth");
	Reflect.deleteProperty(document.documentElement, "clientHeight");
});

describe("placeOf", () => {
	it("puts a tooltip on the right at the top of its control, as tall as it", () => {
		expect(placeOf(box({}), "right", "center")).toEqual({
			top: 100,
			left: 90,
			height: 32,
		});
	});

	it("hangs it under its control, lined up by the edge the caller names", () => {
		view(1000, 800);
		expect(placeOf(box({}), "bottom", "center")).toEqual({
			top: 132,
			left: 70,
		});
		expect(placeOf(box({}), "bottom", "start")).toEqual({
			top: 132,
			left: 50,
		});
		expect(placeOf(box({}), "bottom", "end")).toEqual({
			top: 132,
			right: 910,
		});
	});

	it("puts it over the control when it would leave the window below and fits above", () => {
		view(1000, 200);
		expect(
			placeOf(box({ top: 160, bottom: 192 }), "bottom", "start"),
		).toEqual({
			bottom: 40,
			left: 50,
		});
	});

	it("keeps it under the control when there is no room above either", () => {
		view(1000, 100);
		expect(
			placeOf(box({ top: 10, bottom: 42 }), "bottom", "start"),
		).toEqual({
			top: 42,
			left: 50,
		});
	});

	it("measures with the height the caller gives it once the tooltip is drawn", () => {
		view(1000, 200);
		const control = box({ top: 120, bottom: 152 });
		expect(placeOf(control, "bottom", "start", 30)).toEqual({
			top: 152,
			left: 50,
		});
		expect(placeOf(control, "bottom", "start", 60)).toEqual({
			bottom: 80,
			left: 50,
		});
	});
});

describe("samePlace", () => {
	it("is true for the same pixels and false for any one that differs", () => {
		const place = { top: 1, left: 2, height: 3 };
		expect(samePlace(place, { ...place })).toBe(true);
		for (const other of [
			{ ...place, top: 9 },
			{ ...place, left: 9 },
			{ ...place, height: 9 },
			{ ...place, bottom: 9 },
			{ ...place, right: 9 },
		]) {
			expect(samePlace(place, other)).toBe(false);
		}
	});
});

describe("hasPopupOpen", () => {
	it("is true only for the button of a menu or a dialog that is open", () => {
		const button = document.createElement("button");
		expect(hasPopupOpen(button)).toBe(false);
		button.setAttribute("aria-haspopup", "menu");
		expect(hasPopupOpen(button)).toBe(false);
		button.setAttribute("aria-expanded", "true");
		expect(hasPopupOpen(button)).toBe(true);
		button.setAttribute("aria-expanded", "false");
		expect(hasPopupOpen(button)).toBe(false);
	});
});
