import { describe, expect, it } from "bun:test";

import { hasKeyword, readLabels } from ".";

describe("hasKeyword", () => {
	it("matches a keyword without regard to case, as the server does", () => {
		expect(hasKeyword({ $Important: true }, "$important")).toBe(true);
		expect(hasKeyword({ $IMPORTANT: true }, "$important")).toBe(true);
		expect(hasKeyword({ $important: true }, "$Important")).toBe(true);
	});

	it("says no when the keyword is off, another one or missing", () => {
		expect(hasKeyword({ $important: false }, "$important")).toBe(false);
		expect(hasKeyword({ $importants: true }, "$important")).toBe(false);
		expect(hasKeyword({}, "$important")).toBe(false);
		expect(hasKeyword(undefined, "$important")).toBe(false);
	});
});

describe("readLabels", () => {
	it("reads the labels by name and leaves the protocol's keywords out", () => {
		expect(
			readLabels({
				$seen: true,
				$Important: true,
				$label1: true,
				NonJunk: true,
				Work: true,
				A_C3_B1o: true,
				off: false,
			}),
		).toEqual([
			{ keyword: "A_C3_B1o", name: "Año", tone: 7 },
			{ keyword: "Work", name: "Work", tone: 1 },
		]);
		expect(readLabels(undefined)).toEqual([]);
		expect(readLabels({})).toEqual([]);
	});

	it("holds two spellings of one keyword as one label", () => {
		const labels = readLabels({ Work: true, WORK: true, work: true });
		expect(labels).toHaveLength(1);
		expect(labels[0]?.keyword).toBe("Work");
	});

	it("shows a keyword it cannot read as a name as the keyword itself", () => {
		// The second would read as a right-to-left override.
		expect(
			readLabels({ Work_items: true, exe_E2_80_AEgpj: true }).map(
				(label) => label.name,
			),
		).toEqual(["exe_E2_80_AEgpj", "Work_items"]);
	});

	it("reads no more labels than a message can carry", () => {
		const many: Record<string, boolean> = {};
		for (let n = 0; n < 40; n += 1) {
			many[`label${n}`] = true;
		}
		expect(readLabels(many)).toHaveLength(32);
	});

	it("gives the same order whatever order the server sent", () => {
		const a = readLabels({ b: true, a: true, c: true });
		const b = readLabels({ c: true, a: true, b: true });
		expect(a).toEqual(b);
		expect(a.map((label) => label.name)).toEqual(["a", "b", "c"]);
	});
});
