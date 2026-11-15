import { afterEach, describe, expect, it } from "bun:test";

import { CONTROLS, scrolledAway } from ".";

afterEach(() => {
	document.body.replaceChildren();
});

const rect = (top: number, bottom: number, left = 0, right = 100): DOMRect =>
	({
		top,
		bottom,
		left,
		right,
		width: right - left,
		height: bottom - top,
	}) as DOMRect;

/** A control inside a box that clips, whose rectangle the case sets. */
function inside(overflow: string, clip: DOMRect) {
	const parent = document.createElement("div");
	parent.style.overflowY = overflow;
	parent.getBoundingClientRect = () => clip;
	const control = document.createElement("button");
	parent.append(control);
	document.body.append(parent);
	return control;
}

describe("scrolledAway", () => {
	it("is false for a control wholly or partly in view of its clipping box", () => {
		expect(scrolledAway(inside("auto", rect(0, 100)), rect(10, 40))).toBe(
			false,
		);
		expect(scrolledAway(inside("auto", rect(0, 100)), rect(90, 130))).toBe(
			false,
		);
	});

	it("is true once it is wholly above, below, left or right of a box that clips", () => {
		expect(scrolledAway(inside("auto", rect(50, 100)), rect(0, 50))).toBe(
			true,
		);
		expect(
			scrolledAway(inside("scroll", rect(0, 100)), rect(100, 130)),
		).toBe(true);
		expect(
			scrolledAway(
				inside("hidden", rect(0, 100, 50, 150)),
				rect(10, 40, 0, 50),
			),
		).toBe(true);
		expect(
			scrolledAway(
				inside("clip", rect(0, 100, 0, 100)),
				rect(10, 40, 100, 140),
			),
		).toBe(true);
	});

	it("ignores a box that does not clip and one that is not laid out", () => {
		expect(
			scrolledAway(inside("visible", rect(0, 100)), rect(200, 230)),
		).toBe(false);
		expect(
			scrolledAway(inside("auto", rect(0, 0, 0, 0)), rect(200, 230)),
		).toBe(false);
	});
});

describe("CONTROLS", () => {
	it("names what a pointer can press", () => {
		for (const part of [
			"a[href]",
			"button",
			"label",
			"[role='menuitem']",
		]) {
			expect(CONTROLS).toContain(part);
		}
	});
});
