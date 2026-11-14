import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";

import { ListPaneSkeleton } from ".";

afterEach(cleanup);

describe("ListPaneSkeleton", () => {
	it("holds the place of the toolbar, hidden, and scrolls the list like the real pane", () => {
		const { container } = render(<ListPaneSkeleton />);
		const [toolbar, list] = Array.from(container.children);

		expect(toolbar).toHaveAttribute("aria-hidden", "true");
		expect(list).toHaveClass("overflow-y-auto", "scroll-pt-8");
		expect(list?.querySelector('[aria-busy="true"]')).not.toBeNull();
	});

	it("holds two bars as tall as the search field and the filters, on both pointers", () => {
		const { container } = render(<ListPaneSkeleton />);
		const bars = Array.from(container.firstElementChild?.children ?? []);

		expect(bars).toHaveLength(2);
		for (const bar of bars) {
			expect(bar).toHaveClass("h-8", "pointer-coarse:h-11");
		}
		expect(container.firstElementChild).toHaveClass("gap-2", "p-2");
	});
});
