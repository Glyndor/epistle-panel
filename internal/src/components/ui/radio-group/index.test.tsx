import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from ".";

afterEach(cleanup);

function setup(onValueChange = mock((_value: string) => {})) {
	render(
		<RadioGroup
			aria-label="Queued mail"
			defaultValue="drain"
			onValueChange={onValueChange}
		>
			<span>
				<RadioGroupItem id="q-drain" value="drain" />
				<Label htmlFor="q-drain">Deliver it</Label>
			</span>
			<span>
				<RadioGroupItem id="q-discard" value="discard" />
				<Label htmlFor="q-discard">Drop it</Label>
			</span>
		</RadioGroup>,
	);
	return onValueChange;
}

describe("RadioGroup", () => {
	it("is a named group of radios with the starting choice taken", () => {
		setup();

		expect(
			screen.getByRole("radiogroup", { name: "Queued mail" }),
		).toBeInTheDocument();
		expect(screen.getByRole("radio", { name: "Deliver it" })).toBeChecked();
		expect(
			screen.getByRole("radio", { name: "Drop it" }),
		).not.toBeChecked();
	});

	it("takes the choice that is clicked and reports it", () => {
		const onValueChange = setup();

		fireEvent.click(screen.getByRole("radio", { name: "Drop it" }));

		expect(onValueChange).toHaveBeenCalledWith("discard");
		expect(screen.getByRole("radio", { name: "Drop it" })).toBeChecked();
		expect(
			screen.getByRole("radio", { name: "Deliver it" }),
		).not.toBeChecked();
	});

	it("is one tab stop, and the arrow keys move the choice inside it", async () => {
		const onValueChange = setup();
		const taken = screen.getByRole("radio", { name: "Deliver it" });

		// The group is what Tab reaches; no radio is a stop of its own.
		expect(screen.getByRole("radiogroup")).toHaveAttribute("tabindex", "0");
		for (const radio of screen.getAllByRole("radio")) {
			expect(radio.getAttribute("tabindex")).toBe("-1");
		}

		taken.focus();
		fireEvent.keyDown(taken, { key: "ArrowDown" });

		// Radix moves the focus a tick after the key.
		await waitFor(() =>
			expect(
				screen.getByRole("radio", { name: "Drop it" }),
			).toHaveFocus(),
		);
		expect(onValueChange).toHaveBeenCalledWith("discard");
	});

	it("takes the choice when its label is clicked", () => {
		const onValueChange = setup();

		fireEvent.click(screen.getByText("Drop it"));

		expect(onValueChange).toHaveBeenCalledWith("discard");
	});

	it("grows on a coarse pointer, draws its focus as an outline and carries no inline style", () => {
		setup();
		const radio = screen.getByRole("radio", { name: "Deliver it" });

		expect(radio.className).toContain("pointer-coarse:size-6");
		expect(radio.className).toContain("focus-visible:outline-2");
		expect(radio.className).not.toContain("outline-none");
		expect(radio).not.toHaveAttribute("style");
	});
});
