import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { THEME_CHOICES } from "@/features/theme/config/choices";
import { ThemeTrigger } from ".";

afterEach(cleanup);

describe("ThemeTrigger", () => {
	it("is a named button that carries the current choice", () => {
		for (const choice of THEME_CHOICES) {
			render(<ThemeTrigger choice={choice} />);

			const button = screen.getByRole("button", { name: "themeCurrent" });
			expect(button).toHaveAttribute("data-theme-choice", choice);
			// The icon is decoration: the name says the state.
			expect(button.querySelector("svg")).toHaveAttribute(
				"aria-hidden",
				"true",
			);
			cleanup();
		}
	});

	it("draws a different icon for each choice", () => {
		const icons = THEME_CHOICES.map((choice) => {
			const view = render(<ThemeTrigger choice={choice} />);
			const icon = view.container.querySelector("svg")?.innerHTML;
			view.unmount();
			return icon;
		});

		expect(new Set(icons).size).toBe(THEME_CHOICES.length);
	});

	it("is 32 px on a fine pointer and 44 px on a coarse one, and marks itself when open", () => {
		render(<ThemeTrigger choice="system" aria-expanded="true" />);

		const button = screen.getByRole("button", { name: "themeCurrent" });
		expect(button).toHaveClass("size-8");
		expect(button).toHaveClass("pointer-coarse:size-11");
		expect(button).toHaveClass("aria-expanded:bg-accent");
		expect(button).toHaveClass("focus-visible:outline-2");
		expect(button).toHaveAttribute("aria-expanded", "true");
	});

	it("passes its props to the button, as a menu trigger needs", () => {
		let pressed = 0;
		render(
			<ThemeTrigger
				choice="dark"
				aria-haspopup="menu"
				aria-busy
				onClick={() => {
					pressed += 1;
				}}
			/>,
		);

		const button = screen.getByRole("button", { name: "themeCurrent" });
		button.click();
		expect(pressed).toBe(1);
		expect(button).toHaveAttribute("aria-haspopup", "menu");
		expect(button).toHaveAttribute("aria-busy", "true");
		// Busy is seen, not only announced: its content fades. The button
		// itself keeps its opacity, and with it the contrast of its outline.
		expect(button).toHaveClass("aria-busy:*:opacity-70");
		expect(button.className).not.toMatch(/aria-busy:opacity-/);
	});
});
