import { afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Table, TableBody } from "@/components/ui/table";

import { DataTableNoRows } from ".";

afterEach(cleanup);

const setup = (onClearFilters: (() => void) | undefined) =>
	render(
		<Table>
			<TableBody>
				<DataTableNoRows
					colSpan={3}
					emptyLabel="No accounts yet"
					empty={{
						illustration: "people",
						description: "Create the first one.",
						action: <a href="/new">Create</a>,
					}}
					onClearFilters={onClearFilters}
				/>
			</TableBody>
		</Table>,
	);

describe("DataTableNoRows", () => {
	it("says the list is empty across the whole table, with nothing to press", () => {
		setup(undefined);

		expect(screen.getByRole("cell")).toHaveAttribute("colspan", "3");
		expect(screen.getByText("No accounts yet")).toBeInTheDocument();
		expect(screen.queryByText("noMatches")).toBeNull();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("gives the empty list its own drawing, sentence and next step", () => {
		const { container } = setup(undefined);

		expect(screen.getByText("Create the first one.")).toBeInTheDocument();
		expect(screen.getByRole("link", { name: "Create" })).toHaveAttribute(
			"href",
			"/new",
		);
		expect(container.querySelector("[data-illustration]")).toHaveAttribute(
			"data-illustration",
			"people",
		);
	});

	it("gives a filter that left no row the search drawing and its own sentence, not the list's", () => {
		const { container } = setup(() => {});

		expect(screen.getByText("noMatchesHint")).toBeInTheDocument();
		expect(screen.queryByText("Create the first one.")).toBeNull();
		expect(screen.queryByRole("link", { name: "Create" })).toBeNull();
		expect(container.querySelector("[data-illustration]")).toHaveAttribute(
			"data-illustration",
			"search",
		);
	});

	it("says the filters left no row and takes them off on request", () => {
		const onClearFilters = mock(() => {});
		setup(onClearFilters);

		expect(screen.getByText("noMatches")).toBeInTheDocument();
		expect(screen.queryByText("No accounts yet")).toBeNull();
		const clear = screen.getByRole("button", { name: "clearFilters" });
		expect(clear).toHaveClass("min-h-8", "pointer-coarse:min-h-11");
		fireEvent.click(clear);
		expect(onClearFilters).toHaveBeenCalledTimes(1);
	});

	it("keeps the state inside the visible box of a table wider than the screen, so it is not left out of sight", () => {
		const { container } = setup(undefined);
		const block = container.querySelector("td > div");
		expect(block?.className).toContain("sticky");
		expect(block?.className).toContain("left-0");
		expect(block?.className).toContain("w-[100cqw]");
		expect(
			container.querySelector("[data-slot='table-container']")?.className,
		).toContain("@container");
		// The cell adds no padding of its own, or the block would be 2rem wider
		// than the box and the table would scroll sideways.
		expect(container.querySelector("td")?.className).toContain("p-0");
	});

	it("announces the state that filters leave, as a status, and not the empty list", () => {
		setup(() => undefined);
		expect(screen.getByRole("status")).toHaveTextContent("noMatches");
		cleanup();
		setup(undefined);
		expect(screen.queryByRole("status")).toBeNull();
	});
});
