import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { StatusBadge } from ".";

afterEach(cleanup);

describe("StatusBadge", () => {
	it("says the state in words and draws it with a hidden icon beside the word", () => {
		const { container } = render(
			<StatusBadge glyph="circle-x" variant="destructive">
				Failed
			</StatusBadge>,
		);
		const badge = container.firstElementChild;
		const glyph = badge?.querySelector('[data-slot="glyph"]');

		expect(badge).toHaveAttribute("data-slot", "badge");
		expect(badge).toHaveAttribute("data-status-badge", "");
		expect(badge).toHaveTextContent("Failed");
		expect(badge?.textContent).toBe("Failed");
		expect(glyph).toHaveAttribute("data-glyph", "circle-x");
		expect(glyph).toHaveAttribute("aria-hidden", "true");
		// The icon comes first, then the word.
		expect(badge?.firstElementChild).toBe(glyph as Element);
		expect(screen.getByText("Failed")).toBe(badge as HTMLElement);
	});

	it("takes its tone from the badge's variants, which are tokens", () => {
		for (const [variant, token] of [
			["secondary", "bg-secondary"],
			["muted", "bg-muted"],
			["warning", "bg-warning"],
			["destructive", "bg-destructive-soft"],
			["default", "bg-primary"],
		] as const) {
			const { container } = render(
				<StatusBadge glyph="clock" variant={variant}>
					Word
				</StatusBadge>,
			);

			expect(container.firstElementChild).toHaveClass(token);
			expect(container.firstElementChild).toHaveAttribute(
				"data-variant",
				variant,
			);
			cleanup();
		}
	});

	it("keeps an outline in forced colours, where the fill goes and the icon and word stay", () => {
		const { container } = render(
			<StatusBadge glyph="ban" variant="muted">
				Suppressed
			</StatusBadge>,
		);

		expect(container.firstElementChild).toHaveClass("forced-colors:border");
		expect(container.querySelector('[data-slot="glyph"]')).toHaveClass(
			"forced-color-adjust-none",
		);
	});

	it("sizes the icon at 14 px and lets the caller add a class and an attribute", () => {
		const { container } = render(
			<StatusBadge
				glyph="cloud"
				variant="secondary"
				className="shrink"
				data-testid="origin"
			>
				API
			</StatusBadge>,
		);

		expect(container.querySelector('[data-slot="glyph"]')).toHaveClass(
			"size-3.5",
		);
		expect(screen.getByTestId("origin")).toHaveClass("shrink");
	});
});
