import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { Card } from ".";

afterEach(cleanup);

describe("Card", () => {
	it("renders its children inside a bordered surface", () => {
		render(<Card>Domains</Card>);

		const card = screen.getByText("Domains");
		expect(card).toHaveAttribute("data-slot", "card");
		expect(card).toHaveClass("border", "bg-card");
	});

	it("lets a caller class override its padding", () => {
		render(<Card className="p-6">Domains</Card>);

		const card = screen.getByText("Domains");
		expect(card).toHaveClass("p-6");
		expect(card).not.toHaveClass("p-4");
	});

	it("styles itself with classes only, never an inline style", () => {
		render(<Card>Domains</Card>);

		expect(screen.getByText("Domains")).not.toHaveAttribute("style");
	});
});
