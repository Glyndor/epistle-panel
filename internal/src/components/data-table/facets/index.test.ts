import { describe, expect, it } from "bun:test";

import { countFacets, NO_FACETS, toColumnFilters, toggleFacet } from ".";

describe("toggleFacet", () => {
	it("ticks an option that was not ticked", () => {
		expect(toggleFacet(NO_FACETS, "state", "active")).toEqual({
			state: ["active"],
		});
		expect(toggleFacet({ state: ["active"] }, "state", "off")).toEqual({
			state: ["active", "off"],
		});
	});

	it("unticks one that was, and drops a facet left with none", () => {
		expect(
			toggleFacet({ state: ["active", "off"] }, "state", "active"),
		).toEqual({ state: ["off"] });
		expect(toggleFacet({ state: ["off"] }, "state", "off")).toEqual({});
	});

	it("leaves the other facets as they were, and does not change its argument", () => {
		const before = { state: ["active"], origin: ["file"] };
		const after = toggleFacet(before, "state", "active");

		expect(after).toEqual({ origin: ["file"] });
		expect(before).toEqual({ state: ["active"], origin: ["file"] });
	});
});

describe("countFacets", () => {
	it("counts the ticked options over every facet", () => {
		expect(countFacets(NO_FACETS)).toBe(0);
		expect(countFacets({ state: ["active"] })).toBe(1);
		expect(
			countFacets({ state: ["active", "off"], origin: ["file"] }),
		).toBe(3);
	});
});

describe("toColumnFilters", () => {
	it("gives the table one filter per facet with something ticked", () => {
		expect(toColumnFilters(NO_FACETS)).toEqual([]);
		expect(
			toColumnFilters({ state: ["active", "off"], origin: ["file"] }),
		).toEqual([
			{ id: "state", value: ["active", "off"] },
			{ id: "origin", value: ["file"] },
		]);
	});
});
