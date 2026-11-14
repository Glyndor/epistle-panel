import { describe, expect, it } from "bun:test";

import {
	isLabelKeyword,
	keywordToLabel,
	labelKey,
	labelToKeyword,
	normalizeLabelName,
} from ".";

/** What epistle accepts as a keyword (`imap::keyword::validate`), written again here. */
function isAtom(token: string): boolean {
	return (
		token.length >= 1 &&
		token.length <= 64 &&
		!token.startsWith("\\") &&
		/^[\x21-\x7e]+$/.test(token) &&
		!/[(){ %*"\]\\]/.test(token)
	);
}

describe("labelToKeyword", () => {
	it("leaves letters, digits, a dot and a hyphen as they are", () => {
		expect(labelToKeyword("Work")).toBe("Work");
		expect(labelToKeyword("q4-2026.final")).toBe("q4-2026.final");
	});

	it("writes every other byte as an underscore and two digits", () => {
		expect(labelToKeyword("To do")).toBe("To_20do");
		expect(labelToKeyword("Año")).toBe("A_C3_B1o");
		expect(labelToKeyword("a_b")).toBe("a_5Fb");
		expect(labelToKeyword("$seen")).toBe("_24seen");
		expect(labelToKeyword("\\Deleted")).toBe("_5CDeleted");
		expect(labelToKeyword("🔥")).toBe("_F0_9F_94_A5");
	});

	it("keeps the composed form, one space between words and none at the ends", () => {
		expect(labelToKeyword("  To   do\t")).toBe("To_20do");
		// "n" and a combining tilde are the one letter "ñ".
		expect(labelToKeyword("An\u0303o")).toBe("A_C3_B1o");
	});

	it("writes a name that is a mail client's own keyword as another keyword", () => {
		expect(labelToKeyword("Junk")).toBe("_4Aunk");
		expect(labelToKeyword("NonJunk")).toBe("_4EonJunk");
		expect(labelToKeyword("notjunk")).toBe("_6Eotjunk");
		expect(keywordToLabel("_4Aunk")).toBe("Junk");
		// Not one of them: left alone.
		expect(labelToKeyword("Junk mail")).toBe("Junk_20mail");
		expect(labelToKeyword("Junks")).toBe("Junks");
	});

	it("refuses what is not a name", () => {
		expect(labelToKeyword("")).toBeNull();
		expect(labelToKeyword("   ")).toBeNull();
		expect(labelToKeyword("a\u0000b")).toBeNull();
		expect(labelToKeyword("a\r\nb")).toBeNull();
		expect(labelToKeyword("a\u202eb")).toBeNull();
		expect(labelToKeyword("a\u2066b")).toBeNull();
		expect(labelToKeyword("a\u200bb")).toBeNull();
		expect(labelToKeyword("a\u2028b")).toBeNull();
		expect(labelToKeyword("\ufeffa")).toBeNull();
	});

	it("refuses a name whose keyword passes 64 bytes and takes one of exactly 64", () => {
		expect(labelToKeyword("a".repeat(64))).toBe("a".repeat(64));
		expect(labelToKeyword("a".repeat(65))).toBeNull();
		// Each "ñ" is two bytes, six characters once written: ten fit, eleven do not.
		expect(labelToKeyword(`${"ñ".repeat(10)}abcd`)).toHaveLength(64);
		expect(labelToKeyword(`${"ñ".repeat(10)}abcde`)).toBeNull();
		expect(labelToKeyword("ñ".repeat(11))).toBeNull();
	});

	it("always writes a keyword the server accepts, and reads it back", () => {
		const names = [
			"Work",
			"To do",
			"Año nuevo",
			"Kunden – Österreich",
			"客户",
			"🔥 urgent",
			"a_b_c",
			"100%",
			'say "hi"',
			"(draft) {x} [y] *z*",
			"back\\slash",
			"$money",
			"UPPER lower",
			"..",
			"-",
			"Junk",
			"NonJunk",
			"notjunk",
		];
		for (const name of names) {
			const keyword = labelToKeyword(name);
			expect(keyword).not.toBeNull();
			expect(isAtom(keyword as string)).toBe(true);
			expect(keywordToLabel(keyword as string)).toBe(name);
			expect(isLabelKeyword(keyword as string)).toBe(true);
		}
	});

	it("reads back every code point it can write", () => {
		// Every 97th code point of the planes in use, surrogates left out.
		for (let code = 0x20; code < 0x30000; code += 97) {
			if (code >= 0xd800 && code <= 0xdfff) {
				continue;
			}
			const name = `a${String.fromCodePoint(code)}b`;
			const normal = normalizeLabelName(name);
			if (normal === null) {
				expect(labelToKeyword(name)).toBeNull();
				continue;
			}
			const keyword = labelToKeyword(name);
			expect(keyword).not.toBeNull();
			expect(isAtom(keyword as string)).toBe(true);
			expect(keywordToLabel(keyword as string)).toBe(normal);
		}
	});
});

describe("keywordToLabel", () => {
	it("reads the digits in either case", () => {
		expect(keywordToLabel("A_c3_b1o")).toBe("Año");
	});

	it("shows a keyword it did not write as it is", () => {
		// An underscore with no two digits after it.
		expect(keywordToLabel("Work_items")).toBe("Work_items");
		expect(keywordToLabel("trailing_")).toBe("trailing_");
		expect(keywordToLabel("half_2")).toBe("half_2");
		// A character this module always writes as digits.
		expect(keywordToLabel("Important!")).toBe("Important!");
		expect(keywordToLabel("a+b")).toBe("a+b");
	});

	it("shows as it is a keyword whose digits are not text", () => {
		expect(keywordToLabel("_FF")).toBe("_FF");
		expect(keywordToLabel("_C3")).toBe("_C3");
		expect(keywordToLabel("_C3_28")).toBe("_C3_28");
		// An overlong form of "/" and a lone surrogate.
		expect(keywordToLabel("_C0_AF")).toBe("_C0_AF");
		expect(keywordToLabel("_ED_A0_80")).toBe("_ED_A0_80");
	});

	it("never reads a keyword as a control, a line break or a text-direction override", () => {
		expect(keywordToLabel("a_00b")).toBe("a_00b");
		expect(keywordToLabel("a_0D_0Ab")).toBe("a_0D_0Ab");
		expect(keywordToLabel("a_1Bb")).toBe("a_1Bb");
		// U+202E, the right-to-left override.
		expect(keywordToLabel("exe_E2_80_AEgpj")).toBe("exe_E2_80_AEgpj");
		// U+2066, U+200B, U+2028, U+FEFF.
		expect(keywordToLabel("a_E2_81_A6b")).toBe("a_E2_81_A6b");
		expect(keywordToLabel("a_E2_80_8Bb")).toBe("a_E2_80_8Bb");
		expect(keywordToLabel("a_E2_80_A8b")).toBe("a_E2_80_A8b");
		expect(keywordToLabel("_EF_BB_BFa")).toBe("_EF_BB_BFa");
	});

	it("never shows two keywords as one name", () => {
		// "A", "b" and "." stand for themselves: written as digits they are another keyword.
		expect(keywordToLabel("_41bc")).toBe("_41bc");
		expect(keywordToLabel("a_2Eb")).toBe("a_2Eb");
		expect(keywordToLabel("_4Aunks")).toBe("_4Aunks");
		expect(keywordToLabel("Abc")).toBe("Abc");
		// The same keyword in another case is the same label.
		expect(keywordToLabel("to_20DO")).toBe("to DO");
		expect(keywordToLabel("A_c3_b1o")).toBe("Año");
	});

	it("shows as it is a keyword that reads as a name written another way", () => {
		// A space at an end, two spaces, a decomposed letter: none is how a name is kept.
		expect(keywordToLabel("_20a")).toBe("_20a");
		expect(keywordToLabel("a_20_20b")).toBe("a_20_20b");
		expect(keywordToLabel("An_CC_83o")).toBe("An_CC_83o");
		expect(keywordToLabel("_20")).toBe("_20");
	});
});

describe("isLabelKeyword", () => {
	it("leaves the protocol's keywords out", () => {
		for (const keyword of [
			"$seen",
			"$flagged",
			"$Important",
			"$important",
			"$Forwarded",
			"$Junk",
			"$NotJunk",
			"$Phishing",
			"$MDNSent",
			"$label1",
			"\\Seen",
			"NonJunk",
			"nonjunk",
			"Junk",
			"NotJunk",
			"",
		]) {
			expect(isLabelKeyword(keyword)).toBe(false);
		}
	});

	it("takes anything else", () => {
		for (const keyword of ["Work", "To_20do", "junk-mail", "x"]) {
			expect(isLabelKeyword(keyword)).toBe(true);
		}
	});
});

describe("labelKey", () => {
	it("is the same for two spellings the server matches as one", () => {
		expect(labelKey("Work")).toBe(labelKey("WORK"));
		expect(labelKey("A_C3_B1o")).toBe(labelKey("a_c3_b1O"));
		expect(labelKey("Work")).not.toBe(labelKey("Works"));
	});
});
