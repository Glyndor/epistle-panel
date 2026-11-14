import { afterEach, describe, expect, it } from "bun:test";

import {
	forgetListMemory,
	handFocusToList,
	listMemory,
	rememberScroll,
	turnTo,
} from ".";

afterEach(() => {
	forgetListMemory();
	document.body.replaceChildren();
});

describe("the list's memory", () => {
	it("keeps the scroll of the 20 addresses used last", () => {
		for (let n = 1; n <= 21; n++) {
			rememberScroll(`inbox ${n}`, n * 10);
		}

		expect(listMemory.scroll.size).toBe(20);
		expect(listMemory.scroll.has("inbox 1")).toBe(false);
		expect(listMemory.scroll.get("inbox 2")).toBe(20);
		expect(listMemory.scroll.get("inbox 21")).toBe(210);
	});

	it("counts an address used again as the most recent", () => {
		for (let n = 1; n <= 20; n++) {
			rememberScroll(`inbox ${n}`, n);
		}
		rememberScroll("inbox 1", 77);
		rememberScroll("inbox 21", 21);

		expect(listMemory.scroll.get("inbox 1")).toBe(77);
		expect(listMemory.scroll.has("inbox 2")).toBe(false);
	});

	it("forgets the rows when a list of another address is drawn, and keeps the scrolls", () => {
		turnTo("inbox");
		listMemory.held = { id: "b", mark: "star" };
		listMemory.acted = "b";
		listMemory.shown = ["a", "b"];
		listMemory.heirs = new Map([["z", "a"]]);
		rememberScroll("inbox", 120);

		turnTo("inbox");
		expect(listMemory.held).toEqual({ id: "b", mark: "star" });
		turnTo("archive");

		expect(listMemory.held).toBeNull();
		expect(listMemory.acted).toBeNull();
		expect(listMemory.shown).toEqual([]);
		expect(listMemory.heirs.size).toBe(0);
		expect(listMemory.scroll.get("inbox")).toBe(120);
	});

	it("hands the focus over for a message and lets go of it at once", () => {
		const button = document.createElement("button");
		document.body.append(button);
		button.focus();

		handFocusToList("b");

		expect(listMemory.held).toEqual({ id: "b", mark: null });
		expect(listMemory.acted).toBe("b");
		expect(document.activeElement).toBe(document.body);
	});

	it("forgets everything between tests", () => {
		turnTo("inbox");
		listMemory.held = { id: "b", mark: null };
		listMemory.acted = "b";
		listMemory.shown = ["b"];
		listMemory.search = { text: "sale", max: 200 };
		listMemory.chips = "from";
		rememberScroll("inbox", 5);

		forgetListMemory();

		expect(listMemory).toEqual({
			scroll: new Map(),
			held: null,
			acted: null,
			shown: [],
			heirs: new Map(),
			address: null,
			search: null,
			chips: null,
		});
	});
});
