import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { PageSkeleton } from ".";

afterEach(cleanup);

describe("PageSkeleton", () => {
	it("is a busy, silent placeholder with no text for assistive tech to read", () => {
		const { container } = render(<PageSkeleton />);

		expect(container.firstElementChild).toHaveAttribute(
			"aria-busy",
			"true",
		);
		expect(container.textContent).toBe("");
		expect(
			container.querySelectorAll("[data-slot='skeleton']"),
		).toHaveLength(2);
	});
});
