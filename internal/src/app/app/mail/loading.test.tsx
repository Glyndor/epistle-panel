import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import ComposeLoading from "./compose/loading";
import MailLoading from "./loading";

afterEach(cleanup);

describe("the webmail's loading states", () => {
	it("the mail page shows its panes with a skeleton and says it once to a screen reader", () => {
		const { container } = render(<MailLoading />);

		expect(
			container.querySelectorAll('[aria-busy="true"]').length,
		).toBeGreaterThanOrEqual(2);
		expect(screen.getAllByRole("status")).toHaveLength(1);
		expect(container.querySelector("[style]")).toBeNull();
	});

	it("the composer shows the place of its form", () => {
		const { container } = render(<ComposeLoading />);

		expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
		expect(container.querySelector("[style]")).toBeNull();
	});
});
