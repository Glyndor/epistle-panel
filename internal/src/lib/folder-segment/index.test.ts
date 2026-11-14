import { describe, expect, it } from "bun:test";

import { folderToSegment, segmentToFolder } from ".";

/** What a path segment may be made of with no encoding at all (RFC 3986 unreserved). */
const UNRESERVED = /^[A-Za-z0-9._~-]+$/;

describe("folderToSegment", () => {
	it("leaves letters, digits and a hyphen as they are, and a dot that is not first", () => {
		expect(folderToSegment("INBOX")).toBe("INBOX");
		expect(folderToSegment("q4-2026.final")).toBe("q4-2026.final");
	});

	it("writes a slash, a space and any other byte as an underscore and two digits", () => {
		expect(folderToSegment("Work/Q4")).toBe("Work_2FQ4");
		expect(folderToSegment("To do")).toBe("To_20do");
		expect(folderToSegment("a_b")).toBe("a_5Fb");
		expect(folderToSegment("100%")).toBe("100_25");
		expect(folderToSegment("a?b#c")).toBe("a_3Fb_23c");
		expect(folderToSegment("a\\b")).toBe("a_5Cb");
	});

	it("never writes a segment that is a dot or two", () => {
		expect(folderToSegment(".")).toBe("_2E");
		expect(folderToSegment("..")).toBe("_2E.");
		expect(folderToSegment(".hidden")).toBe("_2Ehidden");
		expect(folderToSegment("../x")).toBe("_2E._2Fx");
	});

	it("writes only characters a path carries as they are", () => {
		const names = [
			"INBOX",
			"Work/Q4",
			"../../etc/passwd",
			"a b",
			"100% done?",
			"x#y",
		];
		for (const name of names) {
			const segment = folderToSegment(name);
			expect(UNRESERVED.test(segment)).toBe(true);
			expect(segment).not.toBe(".");
			expect(segment).not.toBe("..");
			expect(encodeURIComponent(segment)).toBe(segment);
		}
	});
});

describe("segmentToFolder", () => {
	it("reads back every name it wrote", () => {
		// Every 89th code point of the planes in use, surrogates left out.
		for (let code = 0x20; code < 0x30000; code += 89) {
			if (code >= 0xd800 && code <= 0xdfff) {
				continue;
			}
			const name = `a/${String.fromCodePoint(code)}.b`;
			const segment = folderToSegment(name);
			expect(UNRESERVED.test(segment)).toBe(true);
			expect(segmentToFolder(segment)).toBe(name);
		}
	});

	it("reads only the one spelling of a name", () => {
		// Digits in lower case, a letter written as digits, a dot written as digits where it stands for itself.
		expect(segmentToFolder("Work_2fQ4")).toBeNull();
		expect(segmentToFolder("_57ork")).toBeNull();
		expect(segmentToFolder("a_2Eb")).toBeNull();
		expect(segmentToFolder("Work_2FQ4")).toBe("Work/Q4");
		expect(segmentToFolder("_2Ehidden")).toBe(".hidden");
	});

	it("names nothing for what it does not write", () => {
		for (const segment of [
			"",
			".",
			"..",
			".hidden",
			"a b",
			"a/b",
			"a%2Fb",
			"a_",
			"a_2",
			"a_ZZ",
			"a~b",
			"_FF",
			"_C3",
			"_C0_AF",
			"_ED_A0_80",
		]) {
			expect(segmentToFolder(segment)).toBeNull();
		}
	});

	it("gives the name as it is, with whatever it holds, for the schema to judge", () => {
		// A control and a text-direction override decode: the folder id's own schema refuses them.
		expect(segmentToFolder("a_00b")).toBe("a\u0000b");
		expect(segmentToFolder("a_0Ab")).toBe("a\nb");
	});
});
