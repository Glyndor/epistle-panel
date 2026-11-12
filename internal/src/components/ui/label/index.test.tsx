import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { Label } from ".";

afterEach(cleanup);

describe("Label", () => {
	it("names the control its htmlFor points at", () => {
		render(
			<>
				<Label htmlFor="who">Name</Label>
				<input id="who" />
			</>,
		);

		expect(screen.getByLabelText("Name")).toHaveAttribute("id", "who");
	});

	it("styles itself with classes only, never an inline style", () => {
		render(<Label>Name</Label>);

		expect(screen.getByText("Name")).not.toHaveAttribute("style");
	});
});
