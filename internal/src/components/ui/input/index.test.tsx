import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Input } from ".";

afterEach(cleanup);

describe("Input", () => {
	it("passes its type, name and required flag to the native input", () => {
		render(
			<Input aria-label="Password" type="password" name="pw" required />,
		);

		const input = screen.getByLabelText("Password");
		expect(input).toHaveAttribute("type", "password");
		expect(input).toHaveAttribute("name", "pw");
		expect(input).toBeRequired();
	});

	it("takes typed text", () => {
		render(<Input aria-label="Name" />);

		const input = screen.getByLabelText("Name");
		fireEvent.change(input, { target: { value: "admin" } });
		expect(input).toHaveValue("admin");
	});

	it("is 32px on a fine pointer and keeps a 44px minimum on a coarse one", () => {
		// happy-dom computes no layout, so the class is the contract; the
		// rendered size is measured in a real browser.
		render(<Input aria-label="Name" />);

		const input = screen.getByLabelText("Name");
		expect(input).toHaveClass("min-h-8");
		expect(input).toHaveClass("pointer-coarse:min-h-11");
	});

	it("lets a caller class override the minimum height", () => {
		render(<Input aria-label="Name" className="min-h-12" />);

		const input = screen.getByLabelText("Name");
		expect(input).toHaveClass("min-h-12");
		expect(input).not.toHaveClass("min-h-8");
	});

	it("styles itself with classes only, never an inline style", () => {
		render(<Input aria-label="Name" />);

		expect(screen.getByLabelText("Name")).not.toHaveAttribute("style");
	});

	it("shows the invalid state with the destructive border and still reacts to hover", () => {
		// Hover on an invalid field must not look like its rest state.
		render(<Input aria-label="Name" aria-invalid="true" />);

		const input = screen.getByLabelText("Name");
		expect(input).toHaveClass(
			"aria-invalid:border-destructive",
			"aria-invalid:hover:border-destructive/70",
		);
	});
});
