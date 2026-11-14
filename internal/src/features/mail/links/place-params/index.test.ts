import { describe, expect, it } from "bun:test";

import { messageOfSegment, placeOfFolder, placeOfRole } from ".";

describe("placeOfRole", () => {
	it("reads the six roles, spelled exactly", () => {
		for (const role of [
			"inbox",
			"drafts",
			"sent",
			"archive",
			"junk",
			"trash",
		]) {
			expect<unknown>(placeOfRole(role)).toEqual({ role });
		}
		for (const segment of [
			"Inbox",
			"INBOX",
			"spam",
			"all",
			"",
			"toString",
		]) {
			expect(placeOfRole(segment)).toBeNull();
		}
	});
});

describe("placeOfFolder", () => {
	it("reads the folder a segment names", () => {
		expect(placeOfFolder("INBOX")).toEqual({ box: "INBOX" });
		expect(placeOfFolder("Work_2FQ4")).toEqual({ box: "Work/Q4" });
		expect(placeOfFolder("a".repeat(256))).toEqual({
			box: "a".repeat(256),
		});
	});

	it("names nothing for a segment not written this way, or a name the folder schema refuses", () => {
		for (const segment of [
			"",
			"Work%2FQ4",
			"Work_2fQ4",
			"a_00b",
			"a_0Ab",
			"a_E2_80_AEb",
			"a_E2_81_A6b",
			"a".repeat(257),
		]) {
			expect([segment, placeOfFolder(segment)]).toEqual([segment, null]);
		}
	});
});

describe("messageOfSegment", () => {
	it("reads an id and nothing else", () => {
		const id = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
		expect(messageOfSegment(id)).toBe(id);
		for (const segment of ["", "x", `${id}.1`, `${id}/`, "../x"]) {
			expect(messageOfSegment(segment)).toBeNull();
		}
	});
});
