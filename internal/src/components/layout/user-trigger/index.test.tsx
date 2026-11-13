import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { UserTrigger } from ".";

afterEach(cleanup);

describe("UserTrigger", () => {
	it("is a button named for the account, with its initials and its name", () => {
		render(<UserTrigger name="jose.caro" />);

		const button = screen.getByRole("button", { name: "account" });
		expect(button).toHaveTextContent("JC");
		expect(button).toHaveTextContent("jose.caro");
		// The initials and the visible copy of the name are decoration: the
		// button's own text says what it is, with no aria-label to disagree.
		expect(button.querySelector('[data-slot="avatar"]')).toHaveAttribute(
			"aria-hidden",
			"true",
		);
		expect(button).not.toHaveAttribute("aria-label");
		expect(
			[...button.querySelectorAll("span")].filter(
				(span) => span.textContent === "jose.caro",
			)[0],
		).toHaveAttribute("aria-hidden", "true");
	});

	it("keeps only the initials on a narrow window, and cuts a long name short on a wide one", () => {
		render(<UserTrigger name={"a".repeat(200)} />);

		const name = screen.getByText("a".repeat(200), { ignore: ".sr-only" });
		expect(name).toHaveClass("hidden", "md:inline", "truncate");
		expect(screen.getByRole("button", { name: "account" })).toHaveClass(
			"max-w-56",
		);
	});

	it("is 32 px on a fine pointer and 44 px on a coarse one, with an outline on keyboard focus", () => {
		render(<UserTrigger name="ana" aria-expanded="true" />);

		const button = screen.getByRole("button", { name: "account" });
		expect(button).toHaveClass("min-h-8", "pointer-coarse:min-h-11");
		expect(button).toHaveClass("pointer-coarse:min-w-11");
		expect(button).toHaveClass("focus-visible:outline-2");
		expect(button).toHaveClass("aria-expanded:bg-accent");
		// Busy is seen, not only announced: its content fades. The button
		// itself keeps its opacity, and with it the contrast of its outline.
		expect(button).toHaveClass("aria-busy:*:opacity-70");
		expect(button.className).not.toMatch(/aria-busy:opacity-/);
	});

	it("shows a name as text, whatever it holds", () => {
		const name = '<img src=x onerror="alert(1)">';
		const { container } = render(<UserTrigger name={name} />);

		expect(container.querySelector("img")).toBeNull();
		expect(
			screen.getByText(name, { ignore: ".sr-only" }),
		).toBeInTheDocument();
	});
});
