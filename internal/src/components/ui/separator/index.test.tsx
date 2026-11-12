import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { Separator } from ".";

afterEach(cleanup);

describe("Separator", () => {
	it("is decorative by default, so assistive tech skips it", () => {
		const { container } = render(<Separator />);

		expect(container.firstElementChild).toHaveAttribute("role", "none");
	});

	it("is exposed as a separator when it carries meaning", () => {
		render(<Separator decorative={false} orientation="vertical" />);

		const separator = screen.getByRole("separator");
		expect(separator).toHaveAttribute("aria-orientation", "vertical");
		expect(separator).toHaveAttribute("data-orientation", "vertical");
	});

	it("styles itself with classes only", () => {
		const { container } = render(<Separator className="mx-2" />);

		expect(container.firstElementChild).toHaveClass("bg-border", "mx-2");
		expect(container.firstElementChild).not.toHaveAttribute("style");
	});
});
