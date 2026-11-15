import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { PageHeader } from ".";

afterEach(cleanup);

describe("PageHeader", () => {
	it("is the page's h1 with one line under it that says what the page is for", () => {
		render(
			<PageHeader icon="inbox" title="Queue" description="What waits." />,
		);

		const heading = screen.getByRole("heading", {
			level: 1,
			name: "Queue",
		});
		expect(heading).toHaveClass("font-semibold", "text-lg");
		expect(heading.textContent).toBe("Queue");
		expect(heading.nextElementSibling?.tagName).toBe("P");
		expect(heading.nextElementSibling).toHaveTextContent("What waits.");
		expect(heading.nextElementSibling).toHaveClass("text-muted-foreground");
		expect(screen.getAllByRole("heading")).toHaveLength(1);
	});

	it("puts a decorative tile before the title, and no words in it", () => {
		const { container } = render(
			<PageHeader
				icon="ban"
				title="Suppression"
				description="Addresses."
			/>,
		);
		const tile = container.querySelector('[data-slot="icon-tile"]');

		expect(tile).toHaveAttribute("aria-hidden", "true");
		expect(tile?.textContent).toBe("");
		expect(tile?.querySelector('[data-glyph="ban"]')).not.toBeNull();
		expect(
			tile?.compareDocumentPosition(screen.getByRole("heading")) ?? 0,
		).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it("keeps the action at the end, whole, and its button works as the page gave it", () => {
		const { container } = render(
			<PageHeader
				icon="users"
				title="Accounts"
				description="People."
				actions={<button type="button">New</button>}
			/>,
		);
		const actions = container.querySelector(
			'[data-slot="page-header-actions"]',
		);

		expect(actions).not.toBeNull();
		expect(
			within(actions as HTMLElement).getByRole("button"),
		).toHaveTextContent("New");
		expect(actions).toHaveClass("shrink-0");
		expect(container.firstElementChild?.lastElementChild).toBe(actions);
	});

	it("draws no actions zone when the page has none", () => {
		const { container } = render(
			<PageHeader icon="users" title="Status" description="Now." />,
		);

		expect(
			container.querySelector('[data-slot="page-header-actions"]'),
		).toBeNull();
	});

	it("wraps: the title group has a basis and may shrink, so the action goes under it when the row is narrow", () => {
		const { container } = render(
			<PageHeader
				icon="users"
				title="Accounts"
				description="People."
				actions={<span>x</span>}
			/>,
		);
		const header = container.firstElementChild;

		expect(header?.tagName).toBe("HEADER");
		expect(header).toHaveClass("flex", "flex-wrap");
		expect(header?.firstElementChild).toHaveClass(
			"min-w-0",
			"flex-[1_1_20rem]",
		);
	});

	it("passes a class to the title for a page whose title can be one long word", () => {
		render(
			<PageHeader
				icon="users"
				title="Account ops"
				description="One."
				titleClassName="break-all"
			/>,
		);

		expect(screen.getByRole("heading", { level: 1 })).toHaveClass(
			"break-all",
			"font-semibold",
		);
	});
});
