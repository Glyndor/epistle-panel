import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";

import { Meter } from ".";

afterEach(cleanup);

const fill = () =>
	document.querySelector(
		"[data-slot='meter-track'] [data-slot='chart-mark']",
	);

describe("Meter", () => {
	it("is a native meter with a name, its value as a percentage and the words for it", () => {
		render(<Meter share={0.25} label="Storage" valueText="1 GB of 4 GB" />);

		const meter = screen.getByRole("meter", { name: "Storage" });
		expect(meter.tagName).toBe("METER");
		expect(meter).toHaveAttribute("min", "0");
		expect(meter).toHaveAttribute("max", "100");
		expect(meter).toHaveAttribute("value", "25");
		expect(meter).toHaveAttribute("aria-valuetext", "1 GB of 4 GB");
		// What a browser without the element shows is the same words.
		expect(meter).toHaveTextContent("1 GB of 4 GB");
	});

	it("draws the bar beside the native element, hidden from assistive tech, as wide as the share", () => {
		render(<Meter share={0.25} label="Storage" valueText="x" />);

		expect(screen.getByRole("meter")).toHaveClass("sr-only");
		const track = document.querySelector("[data-slot='meter-track']");
		expect(track).toHaveAttribute("aria-hidden", "true");
		expect(track).toHaveClass("overflow-hidden", "rounded-full");
		expect(fill()).toHaveAttribute("width", "25%");
		expect(fill()?.childElementCount).toBe(0);
	});

	it("keeps one decimal of the share and brings anything outside the range in", () => {
		const cases: ReadonlyArray<readonly [number, string]> = [
			[0, "0"],
			[0.0004, "0"],
			[0.001, "0.1"],
			[1 / 3, "33.3"],
			[0.999, "99.9"],
			[1, "100"],
			[7, "100"],
			[-1, "0"],
			[Number.NaN, "0"],
		];
		for (const [share, percent] of cases) {
			render(<Meter share={share} label="Storage" valueText="x" />);
			expect([
				share,
				screen.getByRole("meter").getAttribute("value"),
			]).toEqual([share, percent]);
			expect(fill()).toHaveAttribute("width", `${percent}%`);
			cleanup();
		}
	});

	it("paints its tone with a token of the theme, the usual one when told nothing", () => {
		const tones = [
			[undefined, "ok", "bg-primary"],
			["ok", "ok", "bg-primary"],
			["near", "near", "bg-warning-foreground"],
			["full", "full", "bg-destructive"],
		] as const;
		for (const [tone, said, painted] of tones) {
			render(
				<Meter
					share={0.5}
					label="Storage"
					valueText="x"
					{...(tone === undefined ? {} : { tone })}
				/>,
			);
			expect(
				document.querySelector("[data-slot='meter']"),
			).toHaveAttribute("data-tone", said);
			expect(fill()).toHaveClass(painted);
			cleanup();
		}
	});

	it("is served with no style attribute", () => {
		const html = renderToString(
			<Meter share={0.42} label="Storage" valueText="x" tone="near" />,
		);

		expect(html).toContain('width="42%"');
		expect(html).not.toContain("style");
	});
});
