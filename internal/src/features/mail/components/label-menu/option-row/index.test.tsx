import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { LabelOption } from "@/features/mail/labels/label-options";
import { OptionRow } from ".";

afterEach(cleanup);

const option = (check: LabelOption["check"]): LabelOption => ({
	label: { keyword: "Work", name: "Work", tone: 1 },
	check,
});

function draw(
	check: LabelOption["check"],
	tabbable = true,
	onToggle: (option: LabelOption) => void = () => undefined,
) {
	return render(
		<ul>
			<OptionRow
				option={option(check)}
				tabbable={tabbable}
				onToggle={onToggle}
			/>
		</ul>,
	);
}
const box = () =>
	screen.getByRole("checkbox", { name: "Work" }) as HTMLInputElement;

describe("OptionRow", () => {
	it("fills its row under the pointer and presses it one step deeper", () => {
		draw("none");
		const row = box().closest("label");

		expect(row).toHaveClass("hover:bg-accent", "active:bg-accent-press");
		expect(row).not.toHaveClass("hover:bg-surface-sunken");
	});

	it("is a box named for the label, ticked when all carry it", () => {
		draw("all");
		expect(box().checked).toBe(true);
		expect(box().indeterminate).toBe(false);
	});

	it("is empty when none carry it", () => {
		draw("none");
		expect(box().checked).toBe(false);
		expect(box().indeterminate).toBe(false);
	});

	it("is indeterminate, and not ticked, when some carry it", () => {
		draw("some");
		expect(box().checked).toBe(false);
		expect(box().indeterminate).toBe(true);
	});

	it("shows the indeterminate state again after a render that follows a press", () => {
		const { rerender } = draw("some");
		box().indeterminate = false;
		rerender(
			<ul>
				<OptionRow
					option={option("some")}
					tabbable
					onToggle={() => undefined}
				/>
			</ul>,
		);
		expect(box().indeterminate).toBe(true);
	});

	it("asks for the option it is when it is pressed, with a click or the space bar's", () => {
		const asked: LabelOption[] = [];
		draw("none", true, (one) => asked.push(one));
		fireEvent.click(box());
		expect(asked).toEqual([option("none")]);
	});

	it("is one stop of the Tab key only when it is the tabbable one", () => {
		draw("none", true);
		expect(box()).toHaveAttribute("tabindex", "0");
		cleanup();
		draw("none", false);
		expect(box()).toHaveAttribute("tabindex", "-1");
	});

	it("carries the label as its chip, and says its state in the row", () => {
		const { container } = draw("some");
		expect(
			container.querySelector('[data-slot="label-chip"]'),
		).toHaveTextContent("Work");
		expect(container.querySelector("li")).toHaveAttribute(
			"data-check",
			"some",
		);
	});
});
