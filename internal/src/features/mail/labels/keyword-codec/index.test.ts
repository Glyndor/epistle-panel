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
		expect(labelToKeyword("a b_c")).toBe("a_20b_5Fc");
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

	it("refuses what cannot be seen or turns the text around it", () => {
		const invisible = [
			0x00ad, 0x034f, 0x061c, 0x115f, 0x1160, 0x180e, 0x200b, 0x200e,
			0x200f, 0x202a, 0x202e, 0x2060, 0x2061, 0x2064, 0x2066, 0x2069,
			0x2800, 0x3164, 0xfe00, 0xfe0e, 0xfeff, 0xffa0, 0xfff9, 0xe0001,
			0xe0041, 0xe0100,
		];
		for (const code of invisible) {
			const name = `Work${String.fromCodePoint(code)}x`;
			expect([code.toString(16), labelToKeyword(name)]).toEqual([
				code.toString(16),
				null,
			]);
		}
		// Half of a surrogate pair is no character.
		expect(labelToKeyword(`a${String.fromCharCode(0xd800)}b`)).toBeNull();
		expect(labelToKeyword(`a${String.fromCharCode(0xdc00)}`)).toBeNull();
	});

	it("takes a joiner and the emoji selector only where they join or select something", () => {
		const zwnj = String.fromCodePoint(0x200c);
		const zwj = String.fromCodePoint(0x200d);
		const emojiForm = String.fromCodePoint(0xfe0f);
		const heart = String.fromCodePoint(0x2764);
		const fire = String.fromCodePoint(0x1f525);
		// Persian writes this word with a non-joiner inside it.
		const persian = `\u0645\u06cc${zwnj}\u062e\u0648\u0627\u0647\u0645`;
		for (const name of [
			persian,
			`${heart}${emojiForm}`,
			`${heart}${emojiForm}${zwj}${fire}`,
			`${heart}${emojiForm} urgent`,
		]) {
			const keyword = labelToKeyword(name);
			expect(keyword).not.toBeNull();
			expect(keywordToLabel(keyword as string)).toBe(name);
		}
		for (const name of [
			`${zwj}Work`,
			`Work${zwj}`,
			`Work${zwnj}`,
			`Work ${zwj}x`,
			`Work${zwj} x`,
			`Wo${zwj}${zwj}rk`,
			`Wo${zwnj}${zwj}rk`,
			`${emojiForm}Work`,
			`Work ${emojiForm}`,
			`Work${emojiForm}${emojiForm}`,
			`Work${zwj}${emojiForm}`,
		]) {
			expect(labelToKeyword(name)).toBeNull();
		}
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
			"a b_c d",
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

	it("reads back every code point it can write, and writes none that cannot be seen", () => {
		// The categories of what cannot be seen, written again and not taken from the code.
		const format = /[\p{Cc}\p{Cf}\p{Cs}\p{Zl}\p{Zp}]/u;
		// Every 97th code point of every plane, and the surrogates too.
		for (let code = 0x20; code < 0x110000; code += 97) {
			const name = `a${String.fromCodePoint(code)}b`;
			const normal = normalizeLabelName(name);
			if (normal === null) {
				expect(labelToKeyword(name)).toBeNull();
				continue;
			}
			// A joiner between two letters is the one format character let through.
			if (code !== 0x200c && code !== 0x200d) {
				expect([code.toString(16), format.test(normal)]).toEqual([
					code.toString(16),
					false,
				]);
			}
			const keyword = labelToKeyword(name);
			expect(keyword).not.toBeNull();
			expect(isAtom(keyword as string)).toBe(true);
			expect(keywordToLabel(keyword as string)).toBe(normal);
		}
	});
});

describe("a name that is already a keyword", () => {
	it("is that keyword, so what an IMAP client set and what is typed here are one label", () => {
		for (const name of [
			"a_b",
			"Work_items",
			"foo_bar",
			"A+B",
			"x!",
			"_41bc",
		]) {
			expect(keywordToLabel(name)).toBe(name);
			expect(labelToKeyword(name)).toBe(name);
		}
	});

	it("leaves its written-out form showing as the keyword it is, not as the same name", () => {
		const pairs = [
			["foo_bar", "foo_5Fbar"],
			["A+B", "A_2BB"],
			["_41bc", "_5F41bc"],
			["a_b", "a_5Fb"],
		] as const;
		for (const [own, written] of pairs) {
			expect(keywordToLabel(own)).toBe(own);
			expect(keywordToLabel(written)).toBe(written);
			expect(labelToKeyword(written)).toBe(written);
		}
	});
});

describe("two keywords never show as one name", () => {
	// Every keyword of up to four characters over an alphabet that holds each kind:
	// a plain letter in both cases, a digit that is also a hexadecimal digit, the
	// escape, a character that is always written as digits, and a dot.
	const alphabet = ["a", "A", "4", "1", "F", "_", "+", ".", "5", "b"];
	const keywords: string[] = [];
	const grow = (prefix: string, left: number) => {
		if (prefix !== "") {
			keywords.push(prefix);
		}
		if (left > 0) {
			for (const next of alphabet) {
				grow(prefix + next, left - 1);
			}
		}
	};
	grow("", 4);
	// And the written-out forms of names with a space, an accent and an underscore.
	for (const name of ["a b", "a_b", "é", "A_41", "_5F", "a+b", "x_5Fy"]) {
		const escapedForm = [...new TextEncoder().encode(name)]
			.map((byte) =>
				/[A-Za-z0-9.-]/.test(String.fromCharCode(byte))
					? String.fromCharCode(byte)
					: `_${byte.toString(16).toUpperCase().padStart(2, "0")}`,
			)
			.join("");
		keywords.push(escapedForm, `_5F${escapedForm}`, `${escapedForm}_5F`);
	}

	it("over every short keyword, the name tells the keyword", () => {
		const shown = new Map<string, string>();
		for (const keyword of keywords) {
			const name = keywordToLabel(keyword);
			const seen = shown.get(name);
			// The server holds two keywords that differ only in case as one.
			if (
				seen !== undefined &&
				seen.toLowerCase() !== keyword.toLowerCase()
			) {
				throw new Error(`${seen} and ${keyword} both show as ${name}`);
			}
			shown.set(name, keyword);
		}
		expect(shown.size).toBeGreaterThan(5000);
	});

	it("and the keyword written for a shown name is that keyword again", () => {
		for (const keyword of keywords) {
			const name = keywordToLabel(keyword);
			const back = labelToKeyword(name);
			if (back === null) {
				// A keyword that shows as itself and is no name (a control cannot
				// be here: these are all plain ASCII) would be a hole.
				throw new Error(
					`${keyword} shows as ${name}, which is no name`,
				);
			}
			expect(back.toLowerCase()).toBe(keyword.toLowerCase());
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
