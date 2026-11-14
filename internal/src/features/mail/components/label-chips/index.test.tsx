import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import { tip } from "@/components/ui/tooltip/test-support";
import type { LabelView } from "@/features/mail/schemas/mail-view";

import { LabelChips } from ".";

afterEach(() => {
	fireEvent.pointerDown(document.body);
	cleanup();
});

const C = "group-data-[density=compact]/list:";
const label = (name: string, tone: LabelView["tone"] = 1): LabelView => ({
	keyword: name,
	name,
	tone,
});
const six = ["A", "B", "C", "D", "E", "F"].map((name) => label(name));
const chips = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>('[data-slot="label-chip"]'));
const counts = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>('[data-slot="label-more"]'));

describe("LabelChips", () => {
	it("draws nothing for a message with no label", () => {
		const { container } = render(<LabelChips labels={[]} />);

		expect(container.innerHTML).toBe("");
	});

	it("never draws a fourth chip", () => {
		const { container } = render(<LabelChips labels={six} />);

		expect(chips(container).map((chip) => chip.textContent)).toEqual([
			"A",
			"B",
			"C",
		]);
	});

	it("counts every label where no chip shows, the rest after one chip and after three", () => {
		const { container } = render(<LabelChips labels={six} />);

		expect(
			counts(container).map((count) => count.getAttribute("data-count")),
		).toEqual(["6", "5", "3"]);
	});

	it("shows the count of all the labels under 24rem, and under 32rem when compact: the labels never go", () => {
		const { container } = render(<LabelChips labels={six} />);
		const [all] = counts(container);

		// In view from the start, with no chip beside it.
		expect(all).not.toHaveClass("hidden");
		expect(all).toHaveClass(
			"@sm/row:hidden",
			`${C}inline-flex`,
			`${C}@lg/row:hidden`,
		);
		for (const chip of chips(container)) {
			expect(chip).toHaveClass("hidden");
		}
	});

	it("shows one chip from 24rem and three from 32rem when comfortable", () => {
		const { container } = render(<LabelChips labels={six} />);
		const [first, second, third] = chips(container);
		const [, afterOne, afterThree] = counts(container);

		expect(first).toHaveClass("@sm/row:inline-flex");
		expect(second).toHaveClass("@lg/row:inline-flex");
		expect(third).toHaveClass("@lg/row:inline-flex");
		expect(second).not.toHaveClass("@sm/row:inline-flex");
		expect(afterOne).toHaveClass(
			"hidden",
			"@sm/row:inline-flex",
			"@lg/row:hidden",
		);
		expect(afterThree).toHaveClass("hidden", "@lg/row:inline-flex");
	});

	it("shows at most one chip and a count when compact, and only from 32rem", () => {
		const { container } = render(<LabelChips labels={six} />);
		const [first, second, third] = chips(container);
		const [, afterOne, afterThree] = counts(container);

		expect(first).toHaveClass(`${C}hidden`, `${C}@lg/row:inline-flex`);
		for (const other of [second, third]) {
			expect(other).toHaveClass(`${C}hidden`);
			expect(other?.className).not.toContain(`${C}@`);
		}
		expect(afterOne).toHaveClass(`${C}hidden`, `${C}@lg/row:inline-flex`);
		expect(afterThree).toHaveClass(`${C}hidden`);
		expect(afterThree?.className).not.toContain(`${C}@`);
	});

	it("lets a chip give way down to four characters of its name and no further, and never the count", () => {
		const { container } = render(
			<LabelChips
				labels={["Invoices", "Personal", "Travelling", "Later"].map(
					(name) => label(name),
				)}
			/>,
		);

		for (const chip of chips(container)) {
			expect(chip).toHaveClass("shrink", "max-w-28");
			// The chip's least width is its dot, its padding and four characters.
			expect(chip).toHaveClass("min-w-[calc(4ch+1.75rem)]");
			expect(chip).not.toHaveClass("min-w-0");
		}
		for (const count of counts(container)) {
			expect(count).toHaveClass("shrink-0");
		}
		expect(container.firstElementChild).toHaveClass("min-w-0", "shrink");
	});

	it("has a count for a single label only where its chip does not show", () => {
		const { container } = render(<LabelChips labels={[label("Only")]} />);

		expect(chips(container)).toHaveLength(1);
		expect(
			counts(container).map((count) => count.getAttribute("data-count")),
		).toEqual(["1"]);
		expect(counts(container)[0]).toHaveClass("@sm/row:hidden");
	});

	it("is as tall as its line in both densities", () => {
		const { container } = render(<LabelChips labels={six} />);

		for (const each of [...chips(container), ...counts(container)]) {
			expect(each).toHaveClass("h-5", `${C}h-4`);
		}
	});

	it("names the labels behind a count under the pointer, each isolated", () => {
		const { container } = render(<LabelChips labels={six} />);

		fireEvent.pointerEnter(counts(container)[0] as Element);

		expect(tip()).toHaveTextContent("A, B, C, D, E, F");
		expect(tip()?.querySelectorAll("bdi")).toHaveLength(6);
	});

	it("names only the labels its count stands for", () => {
		const { container } = render(<LabelChips labels={six} />);

		fireEvent.pointerEnter(counts(container)[2] as Element);

		expect(
			Array.from(tip()?.querySelectorAll("bdi") ?? []).map(
				(name) => name.textContent,
			),
		).toEqual(["D", "E", "F"]);
	});

	it("is hidden from assistive technology, which hears the labels from the row", () => {
		const { container } = render(<LabelChips labels={[label("Work")]} />);

		expect(container.firstElementChild).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	});
});
