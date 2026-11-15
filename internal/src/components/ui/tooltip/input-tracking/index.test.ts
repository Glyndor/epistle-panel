import { describe, expect, it } from "bun:test";

import {
	isPointerUncovered,
	lastInputWasTab,
	setPointerUncovered,
	watchInput,
} from ".";

describe("input tracking", () => {
	it("notes whether the last key was Tab, and that a press or another key takes the note of an uncovered pointer back", () => {
		watchInput();
		// Asked twice, it listens once: a second call must not add a listener.
		watchInput();

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
		expect(lastInputWasTab()).toBe(true);

		setPointerUncovered(true);
		expect(isPointerUncovered()).toBe(true);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(lastInputWasTab()).toBe(false);
		expect(isPointerUncovered()).toBe(false);

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" }));
		setPointerUncovered(true);
		document.dispatchEvent(new Event("pointerdown"));
		expect(lastInputWasTab()).toBe(false);
		expect(isPointerUncovered()).toBe(false);
	});
});
