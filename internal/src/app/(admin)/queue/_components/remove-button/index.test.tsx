import { afterEach, describe, expect, it, mock } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";

import { stubFetchReject } from "@/lib/api/test-support/fetch";

mock.module("next/cache", () => ({ revalidatePath: () => {} }));

const { RemoveButton } = await import(".");

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";

afterEach(cleanup);

describe("RemoveButton", () => {
	it("renders an accessible remove control", () => {
		render(<RemoveButton id={ID} recipients="a@b.example" />);

		const button = screen.getByRole("button", { name: "removeLabel" });
		expect(button).toBeInTheDocument();
		expect(button).toHaveTextContent("remove");
	});

	it("keeps a 44px touch target on a coarse pointer", () => {
		// No layout under happy-dom: the class is the contract, the rendered
		// size is measured in a browser.
		render(<RemoveButton id={ID} recipients="a@b.example" />);

		expect(screen.getByRole("button", { name: "removeLabel" })).toHaveClass(
			"pointer-coarse:min-h-11",
			"pointer-coarse:min-w-11",
		);
	});

	it("lets the form shrink so a long error wraps instead of overflowing", () => {
		// A shrink-0 form kept the error on one line and pushed the page 20px
		// wider than a 320px screen. No layout under happy-dom, so the class is
		// the contract; the overflow was measured in a browser.
		render(<RemoveButton id={ID} recipients="a@b.example" />);

		const form = screen
			.getByRole("button", { name: "removeLabel" })
			.closest("form");
		expect(form).toHaveClass("min-w-0");
		expect(form).not.toHaveClass("shrink-0");
	});

	it("does not submit when the confirmation is declined", () => {
		window.confirm = () => false;
		render(<RemoveButton id={ID} recipients="a@b.example" />);

		fireEvent.click(screen.getByRole("button", { name: "removeLabel" }));

		// Submission was cancelled, so no failure notice appears.
		expect(screen.queryByText("removeError")).not.toBeInTheDocument();
	});

	it("surfaces a failure notice when removal is confirmed but errors", async () => {
		window.confirm = () => true;
		stubFetchReject();
		render(<RemoveButton id={ID} recipients="a@b.example" />);

		fireEvent.click(screen.getByRole("button", { name: "removeLabel" }));

		await waitFor(() =>
			expect(screen.getByRole("alert")).toHaveTextContent("removeError"),
		);
	});
});
