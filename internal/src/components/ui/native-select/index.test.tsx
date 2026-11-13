import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { NativeSelect, NativeSelectOption } from ".";

afterEach(cleanup);

function setup() {
	return render(
		<form>
			<NativeSelect aria-label="Outcome" name="outcome" defaultValue="">
				<NativeSelectOption value="">Any</NativeSelectOption>
				<NativeSelectOption value="delivered">
					Delivered
				</NativeSelectOption>
			</NativeSelect>
		</form>,
	);
}

describe("NativeSelect", () => {
	it("is a real select on the shared field look, with the panel's arrow and no inline style", () => {
		const { container } = setup();
		const select = screen.getByRole("combobox", { name: "Outcome" });

		expect(select.tagName).toBe("SELECT");
		expect(select.className).toContain("bg-field");
		expect(select.className).toContain("appearance-none");
		expect(select.className).toContain("focus-visible:outline-2");
		// Hover and press each answer with their own tone.
		expect(select).toHaveClass("hover:bg-accent", "active:bg-accent/70");
		expect(container.querySelector("svg")).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("carries its choice in the form it is in, with no script of its own", () => {
		const { container } = setup();

		fireEvent.change(screen.getByRole("combobox", { name: "Outcome" }), {
			target: { value: "delivered" },
		});

		expect(
			new FormData(
				container.querySelector("form") as HTMLFormElement,
			).get("outcome"),
		).toBe("delivered");
	});
});
