import { describe, expect, it } from "bun:test";
import { runCases } from "@/test/prng";
import {
	decodeLabelKeyword,
	encodeLabelName,
	LABEL_NAME_MAX,
	validateLabelName,
} from ".";

describe("exact label names", () => {
	it("shares a 30-byte bound and accepts its boundary without truncation", () => {
		expect(LABEL_NAME_MAX).toBe(30);
		for (const name of [
			"x".repeat(30),
			"ñ".repeat(15),
			"🔥".repeat(7) + "ab",
		]) {
			expect(validateLabelName(name)).toBe(true);
			expect(encodeLabelName(name)).toHaveLength(64);
		}
		for (const name of [
			"",
			"x".repeat(31),
			"ñ".repeat(16),
			"🔥".repeat(8),
			"\ud800",
			"\udc00",
		]) {
			expect(validateLabelName(name)).toBe(false);
			expect(encodeLabelName(name)).toBeNull();
		}
	});

	it("preserves spaces, case, combining marks, BOM and emoji exactly", () => {
		for (const name of [
			"  To   do\t",
			"An\u0303o",
			"Año",
			"Work",
			"work",
			"👩‍💻",
			"❤️",
			"\ufeffx",
			" ",
			"\u0000",
		]) {
			const keyword = encodeLabelName(name) as string;
			expect(decodeLabelKeyword(keyword)).toBe(name);
			expect(encodeLabelName(name)).toBe(keyword);
		}
		expect(encodeLabelName("Work")?.toLowerCase()).not.toBe(
			encodeLabelName("work")?.toLowerCase(),
		);
	});

	it("round trips seeded random Unicode strings as valid atoms", async () => {
		await runCases("label names", 1800, (rng) => {
			let name = rng.string(
				" abAZ09éñ🔥👩‍💻\u0301\u0303_()%$\\",
				rng.int(1, 4),
			);
			const point = rng.int(0, 0x10ffff);
			if (point < 0xd800 || point > 0xdfff)
				name += String.fromCodePoint(point);
			const keyword = encodeLabelName(name) as string;
			expect(typeof keyword).toBe("string");
			expect(keyword).toMatch(/^[\x21-\x7e]{1,64}$/);
			expect(keyword).not.toMatch(/[(){%*"\]\\]/);
			expect(keyword.startsWith("$")).toBe(false);
			expect(decodeLabelKeyword(keyword)).toBe(name);
		});
	});

	it("encodes every forbidden atom character rather than passing it through", () => {
		const forbidden = [
			...' (){%*"\\]',
			...Array.from({ length: 33 }, (_, n) =>
				String.fromCharCode(n === 32 ? 127 : n),
			),
		];
		for (const character of forbidden) {
			const keyword = encodeLabelName(`a${character}b`) as string;
			expect(keyword).toMatch(/^ep1-[0-9a-f]+$/);
			expect(decodeLabelKeyword(keyword)).toBe(`a${character}b`);
		}
	});

	it("rejects raw, malformed, oversized and invalid UTF-8 encodings", () => {
		for (const keyword of [
			"Work",
			"ep1-",
			"ep1-0",
			"ep1-gg",
			"ep1-ff",
			"ep1-c328",
			"ep1-c0af",
			"ep1-eda080",
			"ep1-" + "61".repeat(31),
			"ep1-61 ",
			"ep1-61\n",
			"$seen",
			"\\Seen",
		]) {
			expect(decodeLabelKeyword(keyword)).toBeNull();
		}
		expect(decodeLabelKeyword("EP1-C3B1")).toBe("ñ");
	});
});
