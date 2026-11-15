import { describe, expect, it } from "bun:test";

import { labelTone } from "@/features/mail/labels/label-tone";
import { encodeLabelName } from "@/features/mail/labels/name-codec";
import { compareLabels, hasKeyword, labelOf, readLabels } from ".";

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

	it("leaves out what the server could not have kept as a keyword", () => {
		const long = "x".repeat(65);
		expect(
			readLabels({
				"two words": true,
				"line\nbreak": true,
				'quote"d': true,
				[long]: true,
				"": true,
				Kept: true,
			}),
		).toEqual([{ keyword: "Kept", name: "Kept", tone: 2 }]);
	});

	it("never gives two labels one name", () => {
		const labels = readLabels({
			foo_bar: true,
			foo_5Fbar: true,
			"A+B": true,
			A_2BB: true,
			_41bc: true,
			Abc: true,
		});
		const names = labels.map((label) => label.name);
		expect(new Set(names).size).toBe(names.length);
		expect(names).toHaveLength(6);
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

describe("labels made by the label controls", () => {
	it("shows the name an ep1 keyword holds, cleaned like any text, with the tone of the exact name", () => {
		const keyword = encodeLabelName(" To  do ") ?? "";
		// Shown cleaned (the page collapses the spaces anyway); the keyword is
		// what identifies the label, and the tone is that of the exact name.
		expect(labelOf(keyword)).toEqual({
			keyword,
			name: "To do",
			tone: labelTone(" To  do "),
		});
		const other = encodeLabelName("work") ?? "";
		const labels = readLabels({ [keyword]: true, [other]: true });
		expect(labels.map((label) => label.keyword).sort()).toEqual(
			[keyword, other].sort(),
		);
	});

	it("keeps Work and work apart, which a case-insensitive keyword could not", () => {
		const upper = encodeLabelName("Work") ?? "";
		const lower = encodeLabelName("work") ?? "";
		expect(readLabels({ [upper]: true, [lower]: true })).toHaveLength(2);
	});

	it("is not a label for a keyword of the protocol or one the server would not keep", () => {
		expect(labelOf("$seen")).toBeNull();
		expect(labelOf("two words")).toBeNull();
		expect(labelOf("")).toBeNull();
	});

	it("orders by name and then by keyword", () => {
		const a = { keyword: "b", name: "Same", tone: 1 } as const;
		const b = { keyword: "a", name: "Same", tone: 1 } as const;
		expect(compareLabels(a, b)).toBe(1);
		expect(compareLabels(b, a)).toBe(-1);
		expect(
			compareLabels({ ...a, name: "A" }, { ...b, name: "B" }),
		).toBeLessThan(0);
	});
});
