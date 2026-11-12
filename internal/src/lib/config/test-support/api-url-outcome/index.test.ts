import { describe, expect, it } from "bun:test";

import { outcome } from ".";

describe("outcome", () => {
	it("returns the origin or the module's own error", () => {
		expect(outcome("https://api.example.org/")).toEqual({
			origin: "https://api.example.org",
		});
		expect(outcome("nope")).toHaveProperty("error");
	});
});
