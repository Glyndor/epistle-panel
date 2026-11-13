import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type {
	DataTableFacet,
	FacetSelection,
} from "@/components/data-table/facets";

import { DataTableFiltersMenu } from ".";

afterEach(cleanup);

const facets: DataTableFacet[] = [
	{
		columnId: "state",
		label: "State",
		options: [
			{ value: "active", label: "Active" },
			{ value: "off", label: "Switched off" },
		],
	},
	{
		columnId: "origin",
		label: "Origin",
		options: [
			{ value: "api", label: "API" },
			{ value: "file", label: "Configuration file" },
		],
	},
];

function setup(selection: FacetSelection = {}) {
	const onToggle = mock((_columnId: string, _value: string) => {});
	const onClear = mock(() => {});
	render(
		<main id="main-content">
			<div data-testid="bar">
				<DataTableFiltersMenu
					facets={facets}
					selection={selection}
					onToggle={onToggle}
					onClear={onClear}
				/>
			</div>
		</main>,
	);
	return { onToggle, onClear };
}
const trigger = () => screen.getByRole("button", { name: /filters/ });
const open = async () => {
	fireEvent.keyDown(trigger(), { key: "Enter" });
	return screen.findByRole("menu");
};

describe("DataTableFiltersMenu", () => {
	it("is one button until opened, compact on a fine pointer and 44 px on a coarse one", () => {
		setup();

		expect(trigger()).toHaveClass("min-h-8", "pointer-coarse:min-h-11");
		expect(trigger()).toHaveAttribute("aria-expanded", "false");
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("says nothing about a count while no box is ticked", () => {
		setup();

		expect(trigger().textContent).toBe("filters");
	});

	it("shows how many boxes are ticked, and says it to a screen reader", () => {
		setup({ state: ["active", "off"], origin: ["file"] });

		const badge = trigger().querySelector('[data-slot="badge"]');
		expect(badge?.textContent).toBe("3");
		expect(badge).toHaveAttribute("aria-hidden", "true");
		expect(trigger()).toHaveAccessibleName("filters filtersActive");
	});

	it("groups the boxes by facet, each group under its name", async () => {
		setup();
		await open();

		const groups = screen.getAllByRole("group");
		expect(
			groups.map((group) => group.getAttribute("aria-labelledby")),
		).not.toContain(null);
		expect(
			screen
				.getByRole("group", { name: "State" })
				.querySelectorAll('[role="menuitemcheckbox"]'),
		).toHaveLength(2);
		expect(
			[
				...screen
					.getByRole("group", { name: "Origin" })
					.querySelectorAll('[role="menuitemcheckbox"]'),
			].map((item) => item.textContent),
		).toEqual(["API", "Configuration file"]);
	});

	it("ticks the boxes of the selection, and no other", async () => {
		setup({ origin: ["file"] });
		await open();

		const ticked = screen
			.getAllByRole("menuitemcheckbox")
			.filter((item) => item.getAttribute("aria-checked") === "true")
			.map((item) => item.textContent);
		expect(ticked).toEqual(["Configuration file"]);
	});

	it("reports the facet and the option of a box, and stays open", async () => {
		const { onToggle } = setup();
		await open();

		fireEvent.click(
			screen.getByRole("menuitemcheckbox", { name: "Switched off" }),
		);

		expect(onToggle).toHaveBeenCalledWith("state", "off");
		expect(screen.getByRole("menu")).toBeInTheDocument();
	});

	it("cannot clear while nothing is ticked", async () => {
		const { onClear } = setup();
		await open();
		const clear = screen.getByRole("menuitem", { name: "deselectAll" });

		expect(clear).toHaveAttribute("aria-disabled", "true");
		fireEvent.click(clear);
		expect(onClear).not.toHaveBeenCalled();
	});

	it("clears once something is ticked", async () => {
		const { onClear } = setup({ state: ["active"] });
		await open();
		const clear = screen.getByRole("menuitem", { name: "deselectAll" });

		expect(clear).not.toHaveAttribute("aria-disabled");
		fireEvent.click(clear);
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it("renders the list inside the page's main, out of the bar, and adds no style element", async () => {
		const before = document.head.querySelectorAll("style").length;
		setup();
		const menu = await open();

		expect(document.getElementById("main-content")?.contains(menu)).toBe(
			true,
		);
		expect(screen.getByTestId("bar").contains(menu)).toBe(false);
		expect(document.head.querySelectorAll("style").length).toBe(before);
		expect(document.body).not.toHaveAttribute("data-scroll-locked");
	});
});
