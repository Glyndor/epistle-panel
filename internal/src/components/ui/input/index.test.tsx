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

	it("is a tonal well with no border at rest, and shows a destructive border only when invalid", () => {
		render(
			<>
				<Input aria-label="Name" />
				<Input aria-label="Bad" aria-invalid="true" />
			</>,
		);

		const rest = screen.getByLabelText("Name");
		expect(rest).toHaveClass(
			"bg-field",
			"border-transparent",
			"hover:bg-accent",
		);
		expect(rest).not.toHaveClass("border-input");
		const bad = screen.getByLabelText("Bad");
		expect(bad).toHaveClass(
			"aria-invalid:border-destructive",
			"hover:bg-accent",
		);
	});

	it("takes the focus ring on keyboard focus", () => {
		render(<Input aria-label="Name" />);

		expect(screen.getByLabelText("Name")).toHaveClass(
			"focus-visible:outline-2",
			"focus-visible:outline-ring",
		);
	});
});
