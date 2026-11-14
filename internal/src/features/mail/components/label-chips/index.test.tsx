import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render } from "@testing-library/react";

import type { LabelView } from "@/features/mail/schemas/mail-view";

import { LabelChips } from ".";

afterEach(cleanup);

const TONES = [1, 2, 3, 4, 5, 6, 7, 8] as const;
const label = (name: string, tone: LabelView["tone"] = 1): LabelView => ({
	keyword: name,
	name,
	tone,
});
const chips = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>('[data-slot="label-chip"]'));
const counts = (root: HTMLElement) =>
	Array.from(root.querySelectorAll<HTMLElement>('[data-slot="label-more"]'));

describe("LabelChips", () => {
	it("draws nothing for a message with no label", () => {
		const { container } = render(<LabelChips labels={[]} />);

		expect(container.innerHTML).toBe("");
	});

	it("draws a chip with a dot and the name, isolated, for each label up to three", () => {
		const { container } = render(
			<LabelChips
				labels={[label("Work"), label("Home"), label("Tax")]}
			/>,
		);

		const drawn = chips(container);
		expect(drawn.map((chip) => chip.textContent)).toEqual([
			"Work",
			"Home",
			"Tax",
		]);
		for (const chip of drawn) {
			expect(chip.querySelector("bdi")).not.toBeNull();
			expect(chip.querySelector("span.rounded-full")).not.toBeNull();
		}
		// Three labels fit a wide row: nothing is left to count there.
		expect(counts(container)).toHaveLength(1);
	});

	it("never draws a fourth chip, and counts the rest for the wide row", () => {
		const five = ["A", "B", "C", "D", "E"].map((name) => label(name));
		const { container } = render(<LabelChips labels={five} />);

		expect(chips(container)).toHaveLength(3);
		const [narrow, wide] = counts(container);
		// One chip shows where the row is narrow, so four are left; three
		// where it is wide, so two are.
		expect(narrow).toHaveAttribute("data-count", "4");
		expect(narrow).toHaveClass("@sm/row:hidden");
		expect(wide).toHaveAttribute("data-count", "2");
		expect(wide).toHaveClass("hidden", "@sm/row:inline-flex");
	});

	it("shows one chip where the row is narrow and the others only where it is wide", () => {
		const { container } = render(
			<LabelChips labels={[label("A"), label("B"), label("C")]} />,
		);
		const [first, second, third] = chips(container);

		expect(first).not.toHaveClass("hidden");
		expect(second).toHaveClass("hidden", "@sm/row:inline-flex");
		expect(third).toHaveClass("hidden", "@sm/row:inline-flex");
	});

	it("has no count for a single label", () => {
		const { container } = render(<LabelChips labels={[label("Only")]} />);

		expect(chips(container)).toHaveLength(1);
		expect(counts(container)).toHaveLength(0);
	});

	it("names the labels behind each count under the pointer", () => {
		const five = ["A", "B", "C", "D", "E"].map((name) => label(name));
		const { container } = render(<LabelChips labels={five} />);
		const [narrow, wide] = counts(container);

		fireEvent.pointerEnter(narrow as Element, { pointerType: "mouse" });
		expect(
			narrow?.querySelector('[data-slot="tooltip-content"]')?.textContent,
		).toBe("B, C, D, E");
		fireEvent.pointerLeave(narrow as Element);

		fireEvent.pointerEnter(wide as Element, { pointerType: "mouse" });
		expect(
			wide?.querySelector('[data-slot="tooltip-content"]')?.textContent,
		).toBe("D, E");
	});

	it("draws each of the eight tones with its own class, written out", () => {
		const { container } = render(
			<LabelChips
				labels={TONES.slice(0, 3).map((t) => label(`t${t}`, t))}
			/>,
		);
		expect(
			chips(container).map(
				(chip) =>
					chip
						.querySelector("span")
						?.className.match(/bg-label-\d/)?.[0],
			),
		).toEqual(["bg-label-1", "bg-label-2", "bg-label-3"]);
		cleanup();

		for (const tone of TONES) {
			const view = render(<LabelChips labels={[label("x", tone)]} />);
			const [chip] = chips(view.container);

			expect(chip).toHaveAttribute("data-tone", String(tone));
			expect(chip?.querySelector("span")).toHaveClass(`bg-label-${tone}`);
			cleanup();
		}
	});

	it("is hidden from assistive technology, which hears the labels from the row", () => {
		const { container } = render(<LabelChips labels={[label("Work")]} />);

		expect(container.firstElementChild).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	});

	it("keeps every tone class as text in the source, where the stylesheet looks for it", async () => {
		const source = await Bun.file(
			new URL("./index.tsx", import.meta.url),
		).text();

		for (const tone of TONES) {
			expect(source).toContain(`"bg-label-${tone}"`);
		}
		expect(source).not.toMatch(/bg-label-\$\{/);
	});
});
