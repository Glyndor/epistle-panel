import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { tip } from "@/components/ui/tooltip/test-support";

import { Mark } from ".";

afterEach(() => {
	fireEvent.pointerDown(document.body);
	cleanup();
});

function mark(over: Partial<React.ComponentProps<typeof Mark>> = {}) {
	const seen = { presses: 0 };
	render(
		<Mark
			mark="star"
			set={false}
			label="star it"
			busy={false}
			onPress={() => {
				seen.presses += 1;
			}}
			{...over}
		>
			<svg aria-hidden="true" />
		</Mark>,
	);
	return { seen, button: screen.getByRole("button") };
}

describe("Mark", () => {
	it("is a button named by its label, which says which mark it is and whether it is set", () => {
		const { button } = mark({ mark: "important", set: true });

		expect(button).toHaveAccessibleName("star it");
		expect(button).toHaveAttribute("data-mark", "important");
		expect(button).toHaveAttribute("data-set", "true");
		expect(button).toHaveAttribute("type", "button");
	});

	it("asks for its change on a press", () => {
		const { seen, button } = mark();

		fireEvent.click(button);

		expect(seen.presses).toBe(1);
	});

	it("is 24 px on a fine pointer and 44 px on a coarse one, with its ring inside on both", () => {
		const { button } = mark();

		expect(button).toHaveClass(
			"size-6",
			"pointer-coarse:size-11",
			"focus-visible:-outline-offset-2",
		);
	});

	it("shows when it is set, under the pointer, with the focus in its row and on a coarse pointer, and is never out of reach", () => {
		const { button } = mark();

		expect(button).toHaveClass(
			"opacity-0",
			"data-[set=true]:opacity-100",
			"group-hover/row:opacity-100",
			"group-focus-within/row:opacity-100",
			"focus-visible:opacity-100",
			"pointer-coarse:opacity-100",
			"pointer-events-auto",
		);
		expect(button).not.toHaveClass("hidden");
		expect(button).not.toHaveAttribute("tabindex");
	});

	it("says a change is on its way, and stays pressable", () => {
		const { seen, button } = mark({ busy: true });

		expect(button).toHaveAttribute("aria-busy", "true");
		expect(button).not.toBeDisabled();
		fireEvent.click(button);
		expect(seen.presses).toBe(1);
		cleanup();
		expect(mark().button).not.toHaveAttribute("aria-busy");
	});

	it("says its name in a tooltip under it", () => {
		const { button } = mark();

		fireEvent.pointerEnter(button, { pointerType: "mouse" });

		expect(tip()).toHaveTextContent("star it");
		expect(tip()).toHaveAttribute("data-side", "bottom");
	});
});
