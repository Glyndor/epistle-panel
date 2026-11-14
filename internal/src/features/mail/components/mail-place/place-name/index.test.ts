import { describe, expect, it } from "bun:test";

import { folderName, foldersAbove } from ".";

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

describe("foldersAbove", () => {
	it("is nothing for a folder at the top", () => {
		expect(foldersAbove("Work")).toEqual([]);
		expect(foldersAbove("")).toEqual([]);
	});

	it("is the folders above, outermost first", () => {
		expect(foldersAbove("Work/Q4")).toEqual(["Work"]);
		expect(foldersAbove("Work/2026/Q4")).toEqual(["Work", "2026"]);
	});

	it("cleans each name like the folder's own, and leaves out one that cleans to nothing", () => {
		expect(foldersAbove("Wo\u202erk/Q4")).toEqual(["Work"]);
		expect(foldersAbove("Work//Q4")).toEqual(["Work"]);
		expect(foldersAbove("\u202e/Q4")).toEqual([]);
		expect(foldersAbove(`${"x".repeat(200)}/Q4`)).toEqual([
			`${"x".repeat(80)}…`,
		]);
	});

	it("is nothing for a folder whose own name is the whole of it, which is already what is shown", () => {
		expect(folderName("Work/")).toBe("Work/");
		expect(foldersAbove("Work/")).toEqual([]);
	});
});
