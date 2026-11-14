import { describe, expect, it } from "bun:test";

import type { z } from "zod";

import {
	EMPTY_CONDITIONS,
	type ListConditions,
	listConditionsSchema,
	parseListConditions,
} from ".";

const char = (code: number) => String.fromCodePoint(code);

/** Exactly equal types, or `false`. */
type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
		? true
		: false;

describe("the shape of the conditions", () => {
	it("is what the strict schema gives, every field present", () => {
		const exact: Equal<
			z.output<typeof listConditionsSchema>,
			ListConditions
		> = true;
		const required: Equal<Required<ListConditions>, ListConditions> = true;
		expect([exact, required]).toEqual([true, true]);
	});
});

describe("parseListConditions: nothing given", () => {
	it("reads an empty query as no condition and no rejection", () => {
		expect(parseListConditions({})).toEqual({
			conditions: EMPTY_CONDITIONS,
			rejected: [],
		});
	});

	it("reads an empty parameter as absent, not as a rejection", () => {
		const parsed = parseListConditions({
			q: "",
			from: "",
			to: "",
			subject: "",
			after: "",
			before: "",
			label: "",
			order: "",
		});
		expect(parsed).toEqual({ conditions: EMPTY_CONDITIONS, rejected: [] });
	});

	it("ignores parameters that are no condition", () => {
		const parsed = parseListConditions({ page: "3", filter: "unread" });
		expect(parsed).toEqual({ conditions: EMPTY_CONDITIONS, rejected: [] });
	});
});

describe("parseListConditions: text conditions", () => {
	for (const name of ["q", "from", "to", "subject"] as const) {
		it(`keeps ${name} trimmed`, () => {
			const parsed = parseListConditions({ [name]: "  invoice 42 " });
			expect(parsed.conditions[name]).toBe("invoice 42");
			expect(parsed.rejected).toEqual([]);
		});

		it(`keeps ${name} of 200 characters and rejects one of 201`, () => {
			const fits = parseListConditions({ [name]: "a".repeat(200) });
			expect(fits.conditions[name]).toBe("a".repeat(200));
			expect(fits.rejected).toEqual([]);

			const over = parseListConditions({ [name]: "a".repeat(201) });
			expect(over.conditions[name]).toBe("");
			expect(over.rejected).toEqual([name]);
		});

		it(`measures ${name} before it is trimmed`, () => {
			const padded = parseListConditions({
				[name]: ` ${"a".repeat(199)} `,
			});
			expect(padded.rejected).toEqual([name]);
		});

		it(`reads a blank ${name} as absent`, () => {
			expect(parseListConditions({ [name]: "   " })).toEqual({
				conditions: EMPTY_CONDITIONS,
				rejected: [],
			});
		});
	}

	it("rejects a control, a line or a paragraph separator and names the parameter", () => {
		for (const code of [
			0x00, 0x09, 0x0a, 0x1b, 0x7f, 0x85, 0x2028, 0x2029,
		]) {
			const parsed = parseListConditions({
				from: `ana${char(code)}bel`,
			});
			expect([code, parsed.conditions.from, parsed.rejected]).toEqual([
				code,
				"",
				["from"],
			]);
		}
	});

	it("keeps text in any script, and a format character that is no control", () => {
		const parsed = parseListConditions({
			subject: `Año ${char(0x202e)}fdp.exe`,
			to: "José Ñúñez",
		});
		expect(parsed.conditions.subject).toBe(`Año ${char(0x202e)}fdp.exe`);
		expect(parsed.conditions.to).toBe("José Ñúñez");
		expect(parsed.rejected).toEqual([]);
	});
});

describe("parseListConditions: label", () => {
	it("keeps a label keyword as written", () => {
		for (const label of [
			"Work",
			"To_20do",
			"A_C3_B1o",
			"a+b",
			"x".repeat(64),
		]) {
			const parsed = parseListConditions({ label });
			expect([parsed.conditions.label, parsed.rejected]).toEqual([
				label,
				[],
			]);
		}
	});

	it("rejects a keyword the server would not keep, or one of the protocol", () => {
		for (const label of [
			"x".repeat(65),
			"two words",
			"a(b",
			'a"b',
			"a\\b",
			"Año",
			"$seen",
			"$Important",
			"\\Seen",
			"Junk",
			"NonJunk",
			"notjunk",
		]) {
			const parsed = parseListConditions({ label });
			expect([label, parsed.conditions.label, parsed.rejected]).toEqual([
				label,
				null,
				["label"],
			]);
		}
	});
});

describe("parseListConditions: order", () => {
	it("reads each order and defaults to newest", () => {
		for (const order of ["newest", "oldest", "largest"] as const) {
			const parsed = parseListConditions({ order });
			expect([parsed.conditions.order, parsed.rejected]).toEqual([
				order,
				[],
			]);
		}
		expect(parseListConditions({}).conditions.order).toBe("newest");
	});

	it("rejects an order it does not know", () => {
		for (const order of ["Newest", "smallest", " oldest"]) {
			const parsed = parseListConditions({ order });
			expect([parsed.conditions.order, parsed.rejected]).toEqual([
				"newest",
				["order"],
			]);
		}
	});
});

describe("parseListConditions: each parameter alone", () => {
	it("drops a bad parameter and keeps the others", () => {
		const parsed = parseListConditions({
			q: "report",
			from: "a".repeat(201),
			subject: "Q3",
			after: "2026-02-30",
			before: "2026-11-10",
			label: "$seen",
			order: "oldest",
		});
		expect(parsed.conditions).toEqual({
			...EMPTY_CONDITIONS,
			q: "report",
			subject: "Q3",
			before: "2026-11-10",
			order: "oldest",
		});
		expect(parsed.rejected).toEqual(["from", "after", "label"]);
	});

	it("names every rejection in the order of the parameters", () => {
		const parsed = parseListConditions({
			order: "biggest",
			label: "a b",
			before: "x",
			after: "y",
			subject: "a".repeat(201),
			to: char(0),
			from: char(0x2028),
			q: "a".repeat(201),
		});
		expect(parsed.conditions).toEqual(EMPTY_CONDITIONS);
		expect(parsed.rejected).toEqual([
			"q",
			"from",
			"to",
			"subject",
			"after",
			"before",
			"label",
			"order",
		]);
	});

	it("reads a repeated parameter by its first value", () => {
		const parsed = parseListConditions({
			q: ["first", "second"],
			label: ["Work", "$seen"],
			order: ["largest", "nonsense"],
		});
		expect(parsed.conditions).toEqual({
			...EMPTY_CONDITIONS,
			q: "first",
			label: "Work",
			order: "largest",
		});
		expect(parsed.rejected).toEqual([]);

		const bad = parseListConditions({ q: ["a".repeat(201), "fine"] });
		expect(bad.rejected).toEqual(["q"]);
	});

	it("reads a repeated parameter whose first value is empty as absent", () => {
		expect(parseListConditions({ q: ["", "later"] })).toEqual({
			conditions: EMPTY_CONDITIONS,
			rejected: [],
		});
	});
});

describe("listConditionsSchema", () => {
	const full: ListConditions = {
		q: "report",
		from: "ana",
		to: "bel",
		subject: "Q3",
		after: "2026-11-01",
		before: "2026-11-10",
		label: "Work",
		order: "largest",
	};

	it("accepts every condition and gives it back", () => {
		expect(listConditionsSchema.parse(full)).toEqual(full);
		expect(listConditionsSchema.parse(EMPTY_CONDITIONS)).toEqual(
			EMPTY_CONDITIONS,
		);
	});

	it("trims a text and keeps 200 characters but not 201", () => {
		expect(listConditionsSchema.parse({ ...full, q: " a " }).q).toBe("a");
		expect(
			listConditionsSchema.safeParse({ ...full, q: "a".repeat(200) })
				.success,
		).toBe(true);
		expect(
			listConditionsSchema.safeParse({ ...full, q: "a".repeat(201) })
				.success,
		).toBe(false);
	});

	it("refuses a field it does not know", () => {
		expect(
			listConditionsSchema.safeParse({ ...full, filter: "unread" })
				.success,
		).toBe(false);
	});

	it("refuses a missing field", () => {
		const { label: _, ...withoutLabel } = full;
		expect(listConditionsSchema.safeParse(withoutLabel).success).toBe(
			false,
		);
	});

	it("refuses an empty day or label where null is meant", () => {
		for (const field of ["after", "before", "label"] as const) {
			expect(
				listConditionsSchema.safeParse({ ...full, [field]: "" })
					.success,
			).toBe(false);
		}
	});

	it("refuses each bad value on its own field", () => {
		const cases = [
			["from", char(0x0a)],
			["after", "2026-02-30"],
			["before", "1969-12-31"],
			["label", "$seen"],
			["order", "smallest"],
		] as const;
		for (const [field, value] of cases) {
			const result = listConditionsSchema.safeParse({
				...full,
				[field]: value,
			});
			expect([
				field,
				result.error?.issues.map((issue) => issue.path.join(".")),
			]).toEqual([field, [field]]);
		}
	});
});
