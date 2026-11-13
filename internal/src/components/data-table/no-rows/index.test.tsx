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
});
