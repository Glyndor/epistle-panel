import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from ".";

afterEach(cleanup);

function Sample() {
	return (
		<Table className="extra">
			<TableHeader>
				<TableRow>
					<TableHead scope="col">Domain</TableHead>
				</TableRow>
			</TableHeader>
			<TableBody>
				<TableRow>
					<TableCell>example.org</TableCell>
				</TableRow>
			</TableBody>
		</Table>
	);
}

describe("Table", () => {
	it("renders a semantic table with a column header and a cell", () => {
		render(<Sample />);

		expect(screen.getByRole("table")).toBeInTheDocument();
		expect(
			screen.getByRole("columnheader", { name: "Domain" }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("cell", { name: "example.org" }),
		).toBeInTheDocument();
	});

	it("wraps the table in a container that scrolls sideways", () => {
		render(<Sample />);

		const container = screen.getByRole("table").parentElement;
		expect(container).toHaveAttribute("data-slot", "table-container");
		expect(container).toHaveClass("overflow-x-auto");
	});

	it("passes a caller class to the table, not to the container", () => {
		render(<Sample />);

		expect(screen.getByRole("table")).toHaveClass("extra");
	});

	it("styles itself with classes only, never an inline style", () => {
		render(<Sample />);

		for (const element of [
			screen.getByRole("table"),
			screen.getByRole("columnheader"),
			screen.getByRole("cell"),
		]) {
			expect(element).not.toHaveAttribute("style");
		}
	});

	it("separates rows by tone, not by lines: striped body, tinted hover, no border", () => {
		const { container } = render(<Sample />);

		const wrapper = container.querySelector(
			"[data-slot='table-container']",
		);
		expect(wrapper).toHaveClass("rounded-xl", "bg-card");
		expect(wrapper).not.toHaveClass("border");
		expect(container.querySelector("tbody")?.className).toContain(
			"bg-surface-sunken",
		);
		expect(container.querySelector("tbody")?.className).toContain(
			"bg-accent",
		);
		for (const row of container.querySelectorAll("tr")) {
			expect(row.className).not.toContain("border");
		}
	});
});
