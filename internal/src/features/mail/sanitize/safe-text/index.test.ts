import { describe, expect, it } from "bun:test";

import { MAX_LINE_LENGTH, safeBody, safeLine, stripBidi } from ".";

describe("stripBidi", () => {
	it("removes overrides, embeddings and isolates but not the marks or the text", () => {
		expect(
			stripBidi("a\u202Eb\u202Cc\u2066d\u2069e\u202Af\u202Dg\u202B"),
		).toBe("abcdefg");
		expect(stripBidi("ab\u200Fcd")).toBe("ab\u200Fcd");
		expect(stripBidi("שלום")).toBe("שלום");
	});
});

describe("safeLine", () => {
	it("turns line breaks and controls into one space so a header cannot grow a second line", () => {
		expect(safeLine("Re: hi\r\nBcc: evil@example.org")).toBe(
			"Re: hi Bcc: evil@example.org",
		);
		expect(safeLine("a\u0000b\u0007c\u2028d\u2029e\u0085f\uFEFFg")).toBe(
			"a b c d e f g",
		);
	});

	it("collapses runs of white space and trims", () => {
		expect(safeLine("  a \t\n b   c  ")).toBe("a b c");
	});

	it("drops bidi controls so a name cannot reorder its neighbours", () => {
		expect(safeLine("invoice\u202Etxt.exe")).toBe("invoicetxt.exe");
	});

	it("caps the length and says it was cut", () => {
		const long = "x".repeat(MAX_LINE_LENGTH + 50);
		expect(safeLine(long)).toBe(`${"x".repeat(MAX_LINE_LENGTH)}…`);
		expect(safeLine("abcdef", 3)).toBe("abc…");
	});
});

describe("safeBody", () => {
	it("keeps the line breaks and tabs and reads CR LF and lone CR as a line feed", () => {
		expect(safeBody("a\r\nb\rc\td\ne")).toBe("a\nb\nc\td\ne");
	});

	it("removes controls, separators, the byte-order mark and bidi controls", () => {
		expect(safeBody("a\u0000b\u001Bc\u2028d\uFEFFe\u202Ef")).toBe("abcdef");
	});
});
