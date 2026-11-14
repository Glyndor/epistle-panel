import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import ComposeLoading from "./compose/loading";
import MailLoading from "./loading";

afterEach(cleanup);

describe("the webmail's loading states", () => {
	it("the mail page shows its panes with a skeleton and says it once to a screen reader", () => {
		const { container } = render(<MailLoading />);

		// The list streams into its skeleton; the reader is empty until a
		// message is opened, and the folders are the sidebar's.
		expect(
			container.querySelectorAll('[aria-busy="true"]').length,
		).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(container.querySelector("[style]")).toBeNull();
		const panes = [...(container.firstElementChild?.children ?? [])];
		expect(panes).toHaveLength(2);
		for (const pane of panes) {
			expect(pane).toHaveClass("bg-surface", "rounded-2xl");
		}
	});

	it("the composer shows the place of its form", () => {
		const { container } = render(<ComposeLoading />);

		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(container.querySelector("[style]")).toBeNull();
	});
});
