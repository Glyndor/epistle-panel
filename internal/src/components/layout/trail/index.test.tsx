import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { Route } from "next";

import { narrowText, stepText } from "@/test/trail-steps";
import { Trail, type TrailStep } from ".";

afterEach(cleanup);

const trail = () => screen.getByRole("navigation", { name: "Breadcrumb" });
const items = () => [
	...trail().querySelectorAll<HTMLElement>('[data-slot="breadcrumb-item"]'),
];
const separators = () => [
	...trail().querySelectorAll<HTMLElement>(
		'[data-slot="breadcrumb-separator"]',
	),
];

const area: TrailStep = {
	key: "area",
	text: "Mail",
	href: "/app/mail" as Route,
};
const folder: TrailStep = {
	key: "folder",
	text: "Inbox",
	href: "/app/mail/inbox" as Route,
};

function renderTrail(steps: readonly TrailStep[]) {
	return render(<Trail label="Breadcrumb" steps={steps} />);
}

describe("Trail", () => {
	it("is a named navigation landmark with an ordered list, on one line", () => {
		renderTrail([area, { ...folder, current: true }]);

		const list = trail().querySelector("ol");
		expect(list).toHaveClass("flex-nowrap");
		expect(trail()).toHaveClass("min-w-0");
		expect(items().map((item) => item.textContent)).toEqual([
			"Mail",
			"Inbox",
		]);
	});

	it("links a step that has an address and marks the current one, which is no link", () => {
		renderTrail([area, { ...folder, current: true }]);

		const links = within(trail()).getAllByRole("link");
		expect(links).toHaveLength(1);
		expect(links[0]).toHaveAttribute("href", "/app/mail");
		const current = trail().querySelectorAll('[aria-current="page"]');
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveTextContent("Inbox");
		expect(current[0]?.closest("a")).toBeNull();
	});

	it("draws a step with no address as plain text", () => {
		renderTrail([area, { key: "page", text: "Somewhere" }]);

		expect(within(trail()).getAllByRole("link")).toHaveLength(1);
		expect(screen.getByText("Somewhere").closest("a")).toBeNull();
		expect(trail().querySelector('[aria-current="page"]')).toBeNull();
	});

	it("holds the place of a step whose name is not known yet, and marks no current page for it", () => {
		renderTrail([area, folder, { key: "message", text: null }]);

		expect(items().map((item) => item.textContent)).toEqual([
			"Mail",
			"Inbox",
			"",
		]);
		const bar = trail().querySelector('[data-slot="skeleton"]');
		expect(bar).toHaveAttribute("aria-hidden", "true");
		expect(bar).toHaveClass("max-w-full");
		expect(trail().querySelector('[aria-current="page"]')).toBeNull();
		expect(within(trail()).getAllByRole("link")).toHaveLength(2);
	});

	it("keeps somebody else's text apart from the direction of the text around it", () => {
		const subject = "‮gnp.exe invoice";
		renderTrail([
			area,
			{ ...folder, text: "Q4", foreign: true },
			{ key: "message", text: subject, current: true, foreign: true },
		]);

		const current = trail().querySelector('[aria-current="page"]');
		expect(current?.firstElementChild?.tagName).toBe("BDI");
		expect(current?.textContent).toBe(subject);
		expect(screen.getByText("Q4").tagName).toBe("BDI");
		// A step of the panel's own words needs none.
		expect(screen.getByText("Mail").tagName).not.toBe("BDI");
	});

	it("shows a name as text, whatever it holds", () => {
		const name = '<img src=x onerror="alert(1)">';
		renderTrail([area, { key: "leaf", text: name, current: true }]);

		expect(
			trail().querySelector('[aria-current="page"]')?.textContent,
		).toBe(name);
		expect(trail().querySelector("img")).toBeNull();
	});

	it("puts a decorative mark between the steps, and none before the first", () => {
		renderTrail([area, folder, { key: "m", text: "Hello", current: true }]);

		const list = trail().querySelector("ol") as HTMLElement;
		expect(
			[...list.children].map((child) => child.getAttribute("data-slot")),
		).toEqual([
			"breadcrumb-item",
			"breadcrumb-separator",
			"breadcrumb-item",
			"breadcrumb-separator",
			"breadcrumb-item",
		]);
		for (const mark of separators()) {
			expect(mark).toHaveAttribute("aria-hidden", "true");
			expect(mark).toHaveClass("shrink-0");
		}
	});

	it("writes every step before the last whole, and lets the last one take what is left and be cut short", () => {
		for (const last of [
			{ key: "m", text: "Hello", current: true },
			{ key: "m", text: "a".repeat(300), current: true },
			{ key: "m", text: null },
		] as const) {
			renderTrail([area, folder, last]);

			const [first, second, third] = items();
			for (const item of [first, second]) {
				// No width is taken from a step before the last to make the
				// last one room: it has no cap, and it shrinks only when it
				// alone is wider than the bar.
				expect(item).toHaveClass("min-w-0", "shrink");
				expect(item?.className).not.toMatch(/(^|\s|:)max-w-\d/);
				expect(item?.className).not.toContain("basis-0");
			}
			// The last step has no width of its own: it starts from nothing
			// and grows into the room the others leave.
			expect(third).toHaveClass("min-w-6", "flex-1", "basis-0");
			if (last.text !== null) {
				expect(
					third?.querySelector('[aria-current="page"]'),
				).toHaveClass("truncate");
			}
			cleanup();
		}
	});

	it("fills the cell it is given, so the last step knows the room there is", () => {
		renderTrail([area, { ...folder, current: true }]);

		expect(trail()).toHaveClass("min-w-0", "flex-1");
	});

	it("does not draw a step that only leads up to the page below 768 px, and keeps its words for a screen reader", () => {
		renderTrail([
			{ ...area, collapse: true },
			{ key: "above", text: "Work", foreign: true, collapse: true },
			folder,
			{ key: "m", text: "Hello", current: true },
		]);

		const [first, above, third, fourth] = items();
		// Clipped, not removed: still in the list a screen reader walks.
		expect(first).toHaveClass("max-md:sr-only");
		expect(above).toHaveClass("max-md:sr-only");
		expect(first?.className).not.toContain("hidden");
		// The link itself is gone there, so Tab never lands on a link that
		// is not drawn; its words are written again as plain text, which only
		// the narrow bar keeps.
		expect(first?.querySelector("a")).toHaveClass("max-md:hidden");
		const words = first?.querySelector("[data-slot='breadcrumb-narrow']");
		expect(words).toHaveClass("md:hidden");
		expect(words?.textContent).toBe("Mail");
		expect(words?.closest("a")).toBeNull();
		expect(stepText(first as Element)).toBe("Mail");
		// A step that was words already needs no second copy.
		expect(above).toHaveTextContent("Work");
		expect(above?.querySelector("a")).toBeNull();
		expect(narrowText(above as Element)).toBeNull();
		// The mark after each of them goes with it.
		expect(separators()[0]).toHaveClass("max-md:hidden");
		expect(separators()[1]).toHaveClass("max-md:hidden");
		// The folder and the subject are drawn at every width.
		for (const item of [third, fourth]) {
			expect(item?.className).not.toContain("max-md:");
		}
		expect(third?.querySelector("a")?.className).not.toContain(
			"max-md:hidden",
		);
		expect(narrowText(third as Element)).toBeNull();
		expect(separators()[2]?.className).not.toContain("max-md:hidden");
	});

	it("never collapses the last step, which is where the person is", () => {
		renderTrail([{ ...area, current: true, collapse: true }]);

		expect(items()).toHaveLength(1);
		expect(items()[0]?.className).not.toContain("max-md:");
		expect(separators()).toHaveLength(0);
	});

	it("draws every step at every width unless it is told one may go", () => {
		renderTrail([area, folder, { key: "m", text: "Hello", current: true }]);

		for (const node of [...items(), ...separators()]) {
			expect(node.className).not.toContain("max-md:");
		}
	});

	it("uses no inline style", () => {
		const { container } = renderTrail([
			area,
			folder,
			{ key: "m", text: null },
		]);

		expect(container.querySelector("[style]")).toBeNull();
	});
});
