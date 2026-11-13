import { describe, expect, it } from "bun:test";

import { fieldLength } from ".";

describe("fieldLength", () => {
	it("leaves one character of room over the schema's limit, so a cut paste is over it", () => {
		expect(fieldLength(64)).toBe(65);
		expect(fieldLength(998)).toBe(999);
		// What a browser keeps of a longer paste is over the limit, not at it.
		const kept = "x".repeat(5000).slice(0, fieldLength(64));
		expect(kept.length > 64).toBe(true);
	});
});
