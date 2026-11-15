import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Label } from "@/components/ui/label";

import { Checkbox } from ".";

afterEach(cleanup);

/** What a form with no script would send for this field. */
function sent(form: HTMLFormElement): string {
	return new URLSearchParams(
		Array.from(new FormData(form).entries()).map(([name, value]) => [
			name,
			String(value),
		]),
	).toString();
}

function draw(checked = false) {
	const { container } = render(
		<form>
			<Label htmlFor="box" className="min-h-6">
				<Checkbox
					id="box"
					name="attachment"
					value="1"
					defaultChecked={checked}
				/>
				Has an attachment
			</Label>
		</form>,
	);
	return container.querySelector("form") as HTMLFormElement;
}

describe("Checkbox", () => {
	it("is the browser's own input, so a form can send it before any script has loaded", () => {
		draw();

		const box = screen.getByRole("checkbox", { name: "Has an attachment" });
		expect(box.tagName).toBe("INPUT");
		expect(box).toHaveAttribute("type", "checkbox");
		expect(box).toHaveAttribute("name", "attachment");
	});

	it("sends its value when it is ticked and nothing when it is not", () => {
		const form = draw();
		expect(sent(form)).toBe("");

		fireEvent.click(screen.getByRole("checkbox"));
		expect(sent(form)).toBe("attachment=1");

		fireEvent.click(screen.getByRole("checkbox"));
		expect(sent(form)).toBe("");
	});

	it("starts ticked when the address already asked for it", () => {
		const form = draw(true);

		expect(screen.getByRole("checkbox")).toBeChecked();
		expect(sent(form)).toBe("attachment=1");
	});

	it("is ticked by a press on its label's words", () => {
		draw();

		fireEvent.click(screen.getByText("Has an attachment"));

		expect(screen.getByRole("checkbox")).toBeChecked();
	});

	it("draws its tick from the input's own state, with no inline style and nothing for a screen reader", () => {
		const form = draw();
		const tick = form.querySelector("svg");

		expect(tick).toHaveAttribute("aria-hidden", "true");
		expect(tick?.getAttribute("class")).toContain(
			"peer-checked:opacity-100",
		);
		expect(form.querySelector("[style]")).toBeNull();
	});

	it("answers a hover and a press, ticked or not, and gives the native drawing back in forced colours", () => {
		render(<Checkbox aria-label="x" />);

		const classes = screen.getByRole("checkbox").className;
		for (const answer of [
			"hover:bg-surface-sunken",
			"active:bg-surface-sunken",
			"checked:hover:bg-primary/90",
			"checked:active:bg-primary/80",
			"forced-colors:appearance-auto",
		]) {
			expect(classes).toContain(answer);
		}
		expect(document.querySelector("svg")?.getAttribute("class")).toContain(
			"forced-colors:hidden",
		);
	});

	it("keeps the caller's classes after its own, and passes the disabled state on", () => {
		render(<Checkbox aria-label="x" className="mt-1" disabled />);

		const box = screen.getByRole("checkbox");
		expect(box.className).toContain("mt-1");
		expect(box).toBeDisabled();
		expect(box.className).toContain("disabled:cursor-not-allowed");
	});
});
