import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { LabelChip } from ".";

afterEach(cleanup);

const TONES = [1, 2, 3, 4, 5, 6, 7, 8] as const;

describe("LabelChip", () => {
	it("draws a dot and the name, isolated", () => {
		const { container } = render(
			<LabelChip label={{ keyword: "Work", name: "Work", tone: 3 }} />,
		);
		const chip = container.firstElementChild;

		expect(chip).toHaveAttribute("data-slot", "label-chip");
		expect(chip?.querySelector("bdi")?.textContent).toBe("Work");
		expect(chip?.querySelector("span")).toHaveClass(
			"rounded-full",
			"bg-label-3",
		);
	});

	it("keeps its outline where the system takes the tone of the fill away (forced colours), a border and not a shadow", () => {
		const { container } = render(
			<LabelChip label={{ keyword: "Work", name: "Work", tone: 3 }} />,
		);

		// The pill's fill is a tint, which forced colours drops: the border
		// that shows only then is what is left of its shape.
		expect(container.firstElementChild).toHaveClass(
			"forced-colors:border",
			"forced-colors:border-[CanvasText]",
		);
		expect(container.querySelector("span > span")).toHaveClass(
			"forced-color-adjust-none",
		);
	});

	it("never draws the name narrower than four characters", () => {
		const { container } = render(
			<LabelChip
				label={{ keyword: "Invoices", name: "Invoices", tone: 1 }}
				className="shrink"
			/>,
		);

		// The pill's least width is four characters, the dot and the padding;
		// the name inside gives way to it and is cut with an ellipsis.
		expect(container.firstElementChild).toHaveClass(
			"min-w-[calc(4ch+1.75rem)]",
			"shrink",
		);
		expect(container.firstElementChild).not.toHaveClass("shrink-0");
		expect(container.querySelector("bdi")).toHaveClass(
			"min-w-0",
			"truncate",
		);
	});

	it("never cuts a name of four characters or fewer, and keeps its pill as wide as the name", () => {
		for (const name of ["A", "Tax", "Work", "🔥🔥🔥🔥"]) {
			const { container } = render(
				<LabelChip
					label={{ keyword: name, name, tone: 1 }}
					className="shrink"
				/>,
			);

			// Whatever the caller asks: no least width wider than the name itself.
			expect(container.firstElementChild).toHaveClass("shrink-0");
			expect(container.firstElementChild).not.toHaveClass("shrink");
			expect(container.firstElementChild?.className).not.toContain(
				"min-w-[",
			);
			cleanup();
		}
		// Five characters can be cut down to four.
		const { container } = render(
			<LabelChip label={{ keyword: "Later", name: "Later", tone: 1 }} />,
		);
		expect(container.firstElementChild).toHaveClass(
			"min-w-[calc(4ch+1.75rem)]",
		);
	});

	it("draws each of the eight tones with its own class", () => {
		for (const tone of TONES) {
			const { container } = render(
				<LabelChip label={{ keyword: "x", name: "x", tone }} />,
			);

			expect(container.firstElementChild).toHaveAttribute(
				"data-tone",
				String(tone),
			);
			expect(container.querySelector("span > span")).toHaveClass(
				`bg-label-${tone}`,
			);
			cleanup();
		}
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

	it("takes the caller's classes and attributes", () => {
		const { container } = render(
			<LabelChip
				label={{ keyword: "x", name: "x", tone: 1 }}
				className="h-5"
				aria-hidden="true"
			/>,
		);

		expect(container.firstElementChild).toHaveClass("h-5");
		expect(container.firstElementChild).toHaveAttribute(
			"aria-hidden",
			"true",
		);
	});

	it("holds a control inside its pill after the name, with the end's padding taken", () => {
		const { container } = render(
			<LabelChip
				label={{ keyword: "Work", name: "Work", tone: 3 }}
				after={<button type="button">x</button>}
			/>,
		);
		const chip = container.firstElementChild;

		expect(chip?.lastElementChild?.tagName).toBe("BUTTON");
		expect(chip?.querySelector("bdi")?.textContent).toBe("Work");
		expect(chip).toHaveClass("pe-0");
	});

	it("keeps the pill's own padding when it holds nothing after the name", () => {
		const { container } = render(
			<LabelChip label={{ keyword: "Work", name: "Work", tone: 3 }} />,
		);
		expect(container.firstElementChild).not.toHaveClass("pe-0");
	});
});
