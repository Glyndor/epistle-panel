import { expect, it } from "bun:test";
import {
	DEFAULT_PAGE_SIZE_CHOICE,
	isPageSizeChoice,
	PAGE_SIZE_CHOICES,
	PAGE_SIZE_COOKIE,
	PAGE_SIZE_COOKIE_PATH,
	pageSizeOf,
	parsePageSizeChoice,
} from ".";

it("is the closed list of three sizes, 50 by default, the size the list always had", () => {
	expect([...PAGE_SIZE_CHOICES]).toEqual(["25", "50", "100"]);
	expect(DEFAULT_PAGE_SIZE_CHOICE).toBe("50");
	expect(pageSizeOf(DEFAULT_PAGE_SIZE_CHOICE)).toBe(50);
	expect([PAGE_SIZE_COOKIE, PAGE_SIZE_COOKIE_PATH]).toEqual([
		"page-size",
		"/app",
	]);
});
it("turns each choice into the number it spells", () => {
	expect(PAGE_SIZE_CHOICES.map(pageSizeOf)).toEqual([25, 50, 100]);
});
it("recognizes only the three literal choices and defaults untrusted input to 50", () => {
	for (const choice of PAGE_SIZE_CHOICES) {
		expect(isPageSizeChoice(choice)).toBe(true);
		expect(parsePageSizeChoice(choice)).toBe(choice);
	}
	for (const value of [
		undefined,
		null,
		25,
		100,
		{},
		"",
		"0",
		"10",
		"025",
		" 50 ",
		"50.0",
		"1e2",
		"__proto__",
		"<img>",
	]) {
		expect(isPageSizeChoice(value)).toBe(false);
		expect(parsePageSizeChoice(value)).toBe("50");
	}
});
