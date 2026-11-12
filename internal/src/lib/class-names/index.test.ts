import { describe, expect, it } from "bun:test";

import { cn } from ".";

describe("cn", () => {
	it("joins truthy values and drops the falsy ones", () => {
		expect(
			cn("a", false, undefined, null, "b", { c: true, d: false }),
		).toBe("a b c");
	});

	it("lets the later Tailwind utility win over an earlier conflicting one", () => {
		expect(cn("px-4 py-2", "px-2")).toBe("py-2 px-2");
	});

	it("keeps utilities that do not conflict", () => {
		expect(cn("text-sm", "font-medium")).toBe("text-sm font-medium");
	});
});
