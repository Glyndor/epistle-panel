import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { Badge } from ".";

afterEach(cleanup);

describe("Badge", () => {
	it("is a soft pill with its label in words and no border", () => {
		render(<Badge>Delivered</Badge>);

		const badge = screen.getByText("Delivered");
		expect(badge).toHaveAttribute("data-slot", "badge");
		expect(badge).toHaveAttribute("data-variant", "secondary");
		expect(badge).toHaveClass("rounded-full", "bg-secondary");
		expect(badge).not.toHaveClass("border");
		expect(badge).not.toHaveAttribute("style");
	});

	it("takes its tone from the variant", () => {
		render(
			<>
				<Badge variant="warning">Deferred</Badge>
				<Badge variant="destructive">Failed</Badge>
			</>,
		);

		expect(screen.getByText("Deferred")).toHaveClass("bg-warning");
		expect(screen.getByText("Failed")).toHaveClass("bg-destructive-soft");
	});
});
