import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { Alert, AlertDescription } from ".";

afterEach(cleanup);

describe("Alert", () => {
	it("announces its message as an alert", () => {
		render(
			<Alert>
				<AlertDescription>Server unreachable</AlertDescription>
			</Alert>,
		);

		expect(screen.getByRole("alert")).toHaveTextContent(
			"Server unreachable",
		);
	});

	it("colours the destructive variant with the destructive token", () => {
		render(<Alert variant="destructive">Failed</Alert>);

		expect(screen.getByRole("alert")).toHaveClass("text-destructive");
	});

	it("colours the warning variant with the warning tokens, not the destructive one", () => {
		render(<Alert variant="warning">Unreachable</Alert>);

		const alert = screen.getByRole("alert");
		expect(alert).toHaveClass("bg-warning", "text-warning-foreground");
		expect(alert).not.toHaveClass("text-destructive");
	});

	it("keeps the default variant on the plain card colours", () => {
		render(<Alert>Note</Alert>);

		expect(screen.getByRole("alert")).not.toHaveClass("text-destructive");
	});

	it("styles itself with classes only, never an inline style", () => {
		render(<Alert>Note</Alert>);

		expect(screen.getByRole("alert")).not.toHaveAttribute("style");
	});
});
