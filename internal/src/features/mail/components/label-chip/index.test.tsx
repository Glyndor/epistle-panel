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

	it("never draws the name narrower than four characters", () => {
		const { container } = render(
			<LabelChip label={{ keyword: "Work", name: "Work", tone: 1 }} />,
		);

		// The pill's least width is four characters, the dot and the padding;
		// the name inside gives way to it and is cut with an ellipsis.
		expect(container.firstElementChild).toHaveClass(
			"min-w-[calc(4ch+1.75rem)]",
		);
		expect(container.querySelector("bdi")).toHaveClass(
			"min-w-0",
			"truncate",
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
});
