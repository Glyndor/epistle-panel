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

	it("keeps a 44px minimum height", () => {
		// happy-dom computes no layout, so the class is the contract; the
		// rendered size is measured in a real browser.
		render(<Input aria-label="Name" />);

		expect(screen.getByLabelText("Name")).toHaveClass("min-h-11");
	});

	it("lets a caller class override the minimum height", () => {
		render(<Input aria-label="Name" className="min-h-12" />);

		const input = screen.getByLabelText("Name");
		expect(input).toHaveClass("min-h-12");
		expect(input).not.toHaveClass("min-h-11");
	});

	it("styles itself with classes only, never an inline style", () => {
		render(<Input aria-label="Name" />);

		expect(screen.getByLabelText("Name")).not.toHaveAttribute("style");
	});
});
