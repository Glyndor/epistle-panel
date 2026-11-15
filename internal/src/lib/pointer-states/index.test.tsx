import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { BarList } from "@/components/charts/bar-list";
import { ChartLegend } from "@/components/charts/chart-legend";
import { StackedColumns } from "@/components/charts/stacked-columns";
import { SummaryCard } from "@/components/summary-card";
import { BreadcrumbLink } from "@/components/ui/breadcrumb";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { FORCED_POINTER, FORCED_ROW_POINTER, MARK_POINTER } from ".";

afterEach(cleanup);

const tokens = (classes: string) => classes.split(" ");

describe("the pointer under forced colours", () => {
	it("tells rest, hover and press by the thickness of a system-colour outline, drawn inside the box", () => {
		expect(tokens(FORCED_POINTER)).toEqual([
			"forced-colors:outline-[color:Highlight]",
			"forced-colors:hover:outline-1",
			"forced-colors:hover:-outline-offset-1",
			"forced-colors:active:outline-2",
			"forced-colors:active:-outline-offset-2",
		]);
	});

	it("never draws a ring thicker than 2 px, hover or press, in either mode", () => {
		const all = [
			...tokens(FORCED_POINTER),
			...tokens(FORCED_ROW_POINTER),
			...tokens(MARK_POINTER),
		];
		const widths = all
			.filter((name) => /(^|:)outline-\d+$/.test(name))
			.map((name) => Number(name.slice(name.lastIndexOf("-") + 1)));

		expect(widths.length).toBeGreaterThanOrEqual(6);
		expect(Math.max(...widths)).toBeLessThanOrEqual(2);
		expect(all.some((name) => name.includes("outline-foreground"))).toBe(
			false,
		);
	});

	it("rings a mark of a chart in the theme's ring colour, 1 px under the pointer and 2 px pressed, never over its neighbour", () => {
		expect(tokens(MARK_POINTER)).toEqual([
			"outline-ring",
			"outline-offset-1",
			"hover:outline-1",
			"active:outline-2",
			"active:outline-offset-0",
			"forced-colors:outline-[color:Highlight]",
		]);
		// The marks of a bar sit 2 px apart: 1 px set 1 px off and 2 px set at 0
		// both end inside the gap.
	});

	it("outlines a row only where a pointer can hover, and keeps the press outside that gate", () => {
		const classes = tokens(FORCED_ROW_POINTER);

		expect(classes).toContain(
			"[@media(hover:hover)]:forced-colors:[&_tr:hover]:outline-1",
		);
		expect(classes).toContain("forced-colors:[&_tr:active]:outline-2");
		expect(classes.filter((name) => name.includes(":hover]"))).toHaveLength(
			2,
		);
		expect(
			classes
				.filter((name) => name.includes("hover"))
				.every((name) => name.startsWith("[@media(hover:hover)]")),
		).toBe(true);
	});

	it("is worn by every variant of the button, which pagination, the period pill and the headers share", () => {
		for (const variant of [
			"default",
			"destructive",
			"outline",
			"secondary",
			"ghost",
			"link",
		] as const) {
			const classes = tokens(buttonVariants({ variant }));
			for (const token of tokens(FORCED_POINTER)) {
				expect(classes, `${variant} ${token}`).toContain(token);
			}
		}
		render(<Button>Save</Button>);
		expect(screen.getByRole("button")).toHaveClass(
			"forced-colors:hover:outline-1",
			"forced-colors:active:outline-2",
		);
	});

	it("is worn by a field, whose hover and press the browser's own border does not tell apart", () => {
		render(<Input aria-label="Name" />);

		expect(screen.getByLabelText("Name")).toHaveClass(
			...tokens(FORCED_POINTER),
		);
	});

	it("is worn by the readouts that tint under the pointer: card, legend entry, bar row and column", () => {
		const { container } = render(
			<dl>
				<SummaryCard icon="globe" label="Domains" value="1" />
				<ChartLegend items={[{ key: "a", label: "A", series: 0 }]} />
				<BarList
					rows={[{ key: "r", label: "R", value: 1, valueText: "1" }]}
				/>
				<StackedColumns
					columns={[{ key: "c", values: [1], hint: "h" }]}
					series={[0]}
					formatTick={String}
				/>
			</dl>,
		);

		for (const selector of [
			'[data-slot="summary-card"]',
			'[data-slot="chart-legend"] li',
			'[data-row="r"]',
			'[data-column="c"]',
		]) {
			expect(container.querySelector(selector), selector).toHaveClass(
				...tokens(FORCED_POINTER),
			);
		}
	});

	it("is worn by a breadcrumb link", () => {
		render(<BreadcrumbLink href="/x">Home</BreadcrumbLink>);

		expect(screen.getByRole("link")).toHaveClass(...tokens(FORCED_POINTER));
	});

	it("outlines the rows of a table body, and tints them only under (hover: hover)", () => {
		render(
			<Table>
				<TableBody>
					<TableRow>
						<TableCell>a</TableCell>
					</TableRow>
				</TableBody>
			</Table>,
		);
		const body = document.querySelector('[data-slot="table-body"]');

		expect(body).toHaveClass(...tokens(FORCED_ROW_POINTER));
		// A tap leaves `:hover` on the row until the next tap elsewhere: the
		// fill is gated by the media query, never a bare `:hover` selector.
		expect(body).toHaveClass(
			"[@media(hover:hover)]:[&_tr:hover]:bg-accent",
			"[@media(hover:hover)]:[&_tr:nth-child(even):hover]:bg-accent",
			"[&_tr:nth-child(even)]:bg-surface-sunken",
		);
		expect(body?.className).not.toMatch(/(^|\s)\[&_tr:hover\]:bg-accent/);
		expect(body?.className).not.toContain(":not(:hover)");
	});
});
