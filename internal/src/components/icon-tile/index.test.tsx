import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { IconTile } from ".";

afterEach(cleanup);

describe("IconTile", () => {
	it("is a decorative tile with the drawing inside and no words of its own", () => {
		const { container } = render(<IconTile name="users" />);
		const tile = container.firstElementChild;

		expect(tile).toHaveAttribute("data-slot", "icon-tile");
		expect(tile).toHaveAttribute("aria-hidden", "true");
		expect(tile?.textContent).toBe("");
		expect(tile?.querySelector('[data-slot="glyph"]')).toHaveAttribute(
			"data-glyph",
			"users",
		);
		expect(screen.queryByRole("img")).toBeNull();
	});

	it("takes its tones from tokens, at a fixed size, with the drawing at 20 px", () => {
		const { container } = render(<IconTile name="globe" />);
		const tile = container.firstElementChild;

		expect(tile).toHaveClass(
			"size-9",
			"shrink-0",
			"rounded-lg",
			"bg-secondary",
			"text-secondary-foreground",
		);
		expect(tile?.firstElementChild).toHaveClass("size-5");
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("takes a size from the caller in place of its own", () => {
		const { container } = render(
			<IconTile name="ban" className="size-8" />,
		);

		expect(container.firstElementChild).toHaveClass("size-8");
		expect(container.firstElementChild).not.toHaveClass("size-9");
	});
});
