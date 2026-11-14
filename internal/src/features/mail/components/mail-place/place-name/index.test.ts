import { describe, expect, it } from "bun:test";

import { folderName } from ".";

describe("folderName", () => {
	it("is the last part of a folder's own name", () => {
		expect(folderName("Work")).toBe("Work");
		expect(folderName("Work/Q4")).toBe("Q4");
		expect(folderName("a/b/c d")).toBe("c d");
	});

	it("cleans the name like any text the account wrote", () => {
		expect(folderName("Work/Q4‮gnp")).toBe("Q4gnp");
		expect(folderName("Line\nbreak")).not.toContain("\n");
	});

	it("falls back to the whole name when its last part cleans to nothing", () => {
		expect(folderName("Work/")).toBe("Work/");
		expect(folderName("Work/‮")).toBe("Work/");
	});

	it("is empty for a name that is nothing", () => {
		expect(folderName("")).toBe("");
		expect(folderName("‮")).toBe("");
	});

	it("cuts a long name at the length a title takes, and says it was cut", () => {
		expect(folderName("x".repeat(500))).toBe(`${"x".repeat(80)}…`);
		expect(folderName("x".repeat(80))).toBe("x".repeat(80));
	});
});
