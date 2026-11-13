import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { Textarea } from ".";

afterEach(cleanup);

const classesOf = (element: HTMLElement) => element.className.split(/\s+/);

describe("Textarea", () => {
	it("is a text area on the shared field look, with no inline style", () => {
		render(<Textarea aria-label="Notes" rows={3} defaultValue="hi" />);
		const field = screen.getByRole("textbox", { name: "Notes" });
		const classes = classesOf(field);

		expect(field.tagName).toBe("TEXTAREA");
		expect(classes).toContain("bg-field");
		expect(classes).toContain(
			"shadow-[inset_0_-2px_0_0_var(--field-edge)]",
		);
		expect(classes).toContain("focus-visible:outline-2");
		expect(classes).not.toContain("outline-none");
		expect(field).not.toHaveAttribute("style");
		expect(field).toHaveValue("hi");
	});

	it("is taller than a one-line field, on a coarse pointer too", () => {
		render(<Textarea aria-label="Notes" />);
		const classes = classesOf(
			screen.getByRole("textbox", { name: "Notes" }),
		);

		expect(classes).toContain("min-h-20");
		expect(classes).toContain("pointer-coarse:min-h-20");
		// The one-line field's heights give way, they are not left beside them.
		expect(classes).not.toContain("min-h-8");
		expect(classes).not.toContain("pointer-coarse:min-h-11");
	});

	it("lets a caller set its own height", () => {
		render(<Textarea aria-label="Notes" className="min-h-48" />);
		const classes = classesOf(
			screen.getByRole("textbox", { name: "Notes" }),
		);

		expect(classes).toContain("min-h-48");
		expect(classes).not.toContain("min-h-20");
	});
});
