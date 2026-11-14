import { describe, expect, it } from "bun:test";

import {
	CONDITION_NAMES,
	conditionsToQuery,
	EMPTY_CONDITIONS,
	hasConditions,
	isDefaultOrder,
	type ListConditions,
	withoutCondition,
} from ".";

const FULL: ListConditions = {
	q: "report",
	from: "ana@example.com",
	to: "Bel",
	subject: "Q3 & Q4",
	after: "2026-11-01",
	before: "2026-11-10",
	label: "Work",
	order: "oldest",
};

describe("EMPTY_CONDITIONS", () => {
	it("narrows nothing and sorts newest first", () => {
		expect(EMPTY_CONDITIONS).toEqual({
			q: "",
			from: "",
			to: "",
			subject: "",
			after: null,
			before: null,
			label: null,
			order: "newest",
		});
	});

	it("cannot be changed by a caller", () => {
		expect(Object.isFrozen(EMPTY_CONDITIONS)).toBe(true);
	});

	it("holds every parameter name and nothing else", () => {
		expect(Object.keys(EMPTY_CONDITIONS).sort()).toEqual(
			[...CONDITION_NAMES].sort(),
		);
	});
});

describe("hasConditions", () => {
	it("is false for no condition, whatever the order", () => {
		expect(hasConditions(EMPTY_CONDITIONS)).toBe(false);
		for (const order of ["oldest", "largest"] as const) {
			expect(hasConditions({ ...EMPTY_CONDITIONS, order })).toBe(false);
		}
	});

	it("is true for any one condition", () => {
		const one: Partial<ListConditions>[] = [
			{ q: "a" },
			{ from: "a" },
			{ to: "a" },
			{ subject: "a" },
			{ after: "2026-11-10" },
			{ before: "2026-11-10" },
			{ label: "Work" },
		];
		for (const condition of one) {
			expect([
				condition,
				hasConditions({ ...EMPTY_CONDITIONS, ...condition }),
			]).toEqual([condition, true]);
		}
	});
});

describe("isDefaultOrder", () => {
	it("is true for newest only", () => {
		expect(isDefaultOrder("newest")).toBe(true);
		expect(isDefaultOrder("oldest")).toBe(false);
		expect(isDefaultOrder("largest")).toBe(false);
	});
});

describe("conditionsToQuery", () => {
	it("writes nothing for no condition", () => {
		expect(conditionsToQuery(EMPTY_CONDITIONS)).toEqual([]);
	});

	it("writes every condition in the order of the parameter names, unencoded", () => {
		expect(conditionsToQuery(FULL)).toEqual([
			["q", "report"],
			["from", "ana@example.com"],
			["to", "Bel"],
			["subject", "Q3 & Q4"],
			["after", "2026-11-01"],
			["before", "2026-11-10"],
			["label", "Work"],
			["order", "oldest"],
		]);
	});

	it("leaves out each condition at its default", () => {
		expect(
			conditionsToQuery({
				...EMPTY_CONDITIONS,
				subject: "x",
				before: "2026-11-10",
			}),
		).toEqual([
			["subject", "x"],
			["before", "2026-11-10"],
		]);
		expect(
			conditionsToQuery({ ...EMPTY_CONDITIONS, order: "largest" }),
		).toEqual([["order", "largest"]]);
	});
});

describe("withoutCondition", () => {
	it("puts one condition back to its default and keeps the others", () => {
		for (const name of CONDITION_NAMES) {
			const left = withoutCondition(FULL, name);
			expect(left).toEqual({ ...FULL, [name]: EMPTY_CONDITIONS[name] });
			expect(conditionsToQuery(left).map(([key]) => key)).toEqual(
				CONDITION_NAMES.filter((other) => other !== name),
			);
		}
	});

	it("leaves the conditions it was given as they were", () => {
		const before = { ...FULL };
		withoutCondition(FULL, "q");
		expect(FULL).toEqual(before);
	});

	it("leaves no condition once each one is taken off", () => {
		let left = FULL;
		for (const name of CONDITION_NAMES) {
			left = withoutCondition(left, name);
		}
		expect(left).toEqual(EMPTY_CONDITIONS);
		expect(hasConditions(left)).toBe(false);
	});
});
