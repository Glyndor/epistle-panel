import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { Skeleton } from ".";

afterEach(cleanup);

describe("Skeleton", () => {
	it("is a decorative block that does not animate and sets no inline style", () => {
		const { container } = render(<Skeleton className="h-8" />);

		const block = container.firstElementChild;
		expect(block).toHaveAttribute("aria-hidden", "true");
		expect(block).toHaveClass("bg-muted", "h-8");
		expect(block?.className).not.toContain("animate");
		expect(block).not.toHaveAttribute("style");
	});
});
