import { describe, expect, it } from "bun:test";

import { isOneOf } from ".";

describe("isOneOf", () => {
	const keys = ["a", "b"] as const;

	it("accepts a member and nothing else", () => {
		expect(isOneOf(keys, "a")).toBe(true);
		expect(isOneOf(keys, "b")).toBe(true);
		for (const value of ["", "c", "A", "a ", "toString", "__proto__"]) {
			expect(isOneOf(keys, value)).toBe(false);
		}
	});
});
