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

	it("takes out what draws nothing and is part of no word", () => {
		for (const code of [
			0x200b, 0x2060, 0x2061, 0x2062, 0x2063, 0x2064, 0x180e, 0x115f,
			0x1160, 0x3164, 0xffa0, 0xfff9, 0xfffa, 0xfffb,
		]) {
			expect([
				code.toString(16),
				safeLine(`pay${String.fromCodePoint(code)}pal`),
			]).toEqual([code.toString(16), "paypal"]);
		}
	});

	it("keeps what some text is written with", () => {
		const zwnj = String.fromCodePoint(0x200c);
		const zwj = String.fromCodePoint(0x200d);
		const rlm = String.fromCodePoint(0x200f);
		const emojiForm = String.fromCodePoint(0xfe0f);
		const softHyphen = String.fromCodePoint(0xad);
		// A Persian word with its non-joiner, a family emoji, a heart in its emoji form.
		const persian = `${String.fromCodePoint(0x645, 0x6cc)}${zwnj}${String.fromCodePoint(0x62e, 0x648, 0x627, 0x647, 0x645)}`;
		const family = `${String.fromCodePoint(0x1f468)}${zwj}${String.fromCodePoint(0x1f469)}${zwj}${String.fromCodePoint(0x1f467)}`;
		const heart = `${String.fromCodePoint(0x2764)}${emojiForm}`;
		// The flag of Scotland: a black flag and six tag characters.
		const flag = String.fromCodePoint(
			0x1f3f4,
			0xe0067,
			0xe0062,
			0xe0073,
			0xe0063,
			0xe0074,
			0xe007f,
		);
		for (const text of [
			persian,
			family,
			heart,
			flag,
			`a${rlm}b`,
			`co${softHyphen}operate`,
		]) {
			expect(safeLine(text)).toBe(text);
		}
	});

	it("is empty for a value with nothing in it to see, so the reader's fallback shows", () => {
		const zwj = String.fromCodePoint(0x200d);
		const rlm = String.fromCodePoint(0x200f);
		const alm = String.fromCodePoint(0x61c);
		const softHyphen = String.fromCodePoint(0xad);
		const emojiForm = String.fromCodePoint(0xfe0f);
		const nbsp = String.fromCodePoint(0xa0);
		const filler = String.fromCodePoint(0x3164);
		const zwsp = String.fromCodePoint(0x200b);
		for (const text of [
			"",
			"   ",
			zwj,
			`${rlm}${alm}`,
			`${softHyphen}${softHyphen}`,
			`${emojiForm}`,
			`${nbsp} ${nbsp}`,
			`${filler}${filler}`,
			`${zwsp} ${zwj} ${rlm}`,
			`${String.fromCodePoint(0x202e)}${zwj}`,
			String.fromCodePoint(0xe0041, 0xe007f),
		]) {
			expect([JSON.stringify(text), safeLine(text)]).toEqual([
				JSON.stringify(text),
				"",
			]);
		}
		// One character to see is enough for the rest to stay.
		expect(safeLine(`${rlm}a`)).toBe(`${rlm}a`);
		expect(safeLine(`${zwj}${String.fromCodePoint(0x1f600)}`)).toBe(
			`${zwj}${String.fromCodePoint(0x1f600)}`,
		);
		// A combining mark on its own is something to see.
		expect(safeLine(String.fromCodePoint(0x301))).toBe(
			String.fromCodePoint(0x301),
		);
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
