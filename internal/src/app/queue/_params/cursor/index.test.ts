import { describe, expect, it } from "bun:test";

import { parseCursor } from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const OTHER = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0f";

describe("parseCursor", () => {
	it("passes a UUID through", () => {
		expect(parseCursor(ID)).toBe(ID);
	});

	it("uses only the first value of a repeated parameter", () => {
		expect(parseCursor([ID, OTHER])).toBe(ID);
		expect(parseCursor(["a", ID])).toBeUndefined();
	});

	it("drops anything that is not a UUID", () => {
		for (const value of ["", "a,b", "../x", `${ID}x`, " "]) {
			expect(parseCursor(value)).toBeUndefined();
		}
	});

	it("treats a missing or empty value as no cursor", () => {
		expect(parseCursor(undefined)).toBeUndefined();
		expect(parseCursor([])).toBeUndefined();
	});
});
