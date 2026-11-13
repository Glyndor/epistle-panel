import { describe, expect, it } from "bun:test";

import { filterFn_oneOf } from ".";

/** Run the filter on a bare value, as the table does on a row's. */
const keeps = (value: unknown, ticked: readonly string[]) =>
	filterFn_oneOf.filter(value, ticked, undefined as never, "column");

describe("the facet filter", () => {
	it("keeps a value that is one of the ticked options", () => {
		expect(keeps("active", ["active"])).toBe(true);
		expect(keeps("off", ["active", "off"])).toBe(true);
	});

	it("drops a value that is not ticked, also when a ticked option is part of it", () => {
		expect(keeps("inactive", ["active"])).toBe(false);
		expect(keeps("active", ["inactive"])).toBe(false);
		expect(keeps("off", ["active"])).toBe(false);
		expect(keeps("", ["active"])).toBe(false);
	});

	it("compares the text of a value that is not a string", () => {
		expect(keeps(true, ["true"])).toBe(true);
		expect(keeps(false, ["true"])).toBe(false);
		expect(keeps(3, ["3"])).toBe(true);
	});

	it("is taken off the table when nothing is ticked", () => {
		expect(filterFn_oneOf.autoRemove?.([])).toBe(true);
		expect(filterFn_oneOf.autoRemove?.(undefined)).toBe(true);
		expect(filterFn_oneOf.autoRemove?.(["active"])).toBe(false);
	});
});
