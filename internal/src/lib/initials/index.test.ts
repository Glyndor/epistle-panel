import { describe, expect, it } from "bun:test";

import { initials } from ".";

describe("initials", () => {
	it("is the first letter of a one-word name, upper case", () => {
		expect(initials("admin")).toBe("A");
		expect(initials("ops")).toBe("O");
		expect(initials("Z")).toBe("Z");
	});

	it("is the first letters of the first and the last word", () => {
		expect(initials("jose.caro")).toBe("JC");
		expect(initials("ana_maria-perez")).toBe("AP");
		expect(initials("user+tag@example.org")).toBe("UO");
		expect(initials("  two   words ")).toBe("TW");
	});

	it("counts digits and letters of any script as a word", () => {
		expect(initials("7of9")).toBe("7");
		expect(initials("élodie.ñandú")).toBe("ÉÑ");
		expect(initials("中文.名字")).toBe("中名");
	});

	it("keeps a letter outside the basic plane whole", () => {
		expect(initials("𝒜lice")).toBe("𝒜");
		expect(Array.from(initials("𝒜lice.𝒷ob"))).toHaveLength(2);
	});

	it("is a question mark when the name has no letter or digit", () => {
		for (const name of ["", " ", "...", "@@", "-_-", "🙂", "‮"]) {
			expect(initials(name)).toBe("?");
		}
	});

	it("never lets anything but letters and digits out, whatever the name holds", () => {
		for (const name of [
			"<script>alert(1)</script>",
			'"><img src=x onerror=1>',
			"a\r\nSet-Cookie: b",
			"../../etc/passwd",
			"x".repeat(10_000),
		]) {
			const out = initials(name);

			expect(Array.from(out).length).toBeLessThanOrEqual(2);
			expect(out).toMatch(/^[\p{L}\p{N}]{1,2}$/u);
		}
	});
});
