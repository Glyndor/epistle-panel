import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";
import type { Route } from "next";

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

	it("cuts every step short where there is no room: a step before the last up to a width, the last first", () => {
		for (const last of [
			{ key: "m", text: "Hello", current: true },
			{ key: "m", text: "a".repeat(300), current: true },
			{ key: "m", text: null },
		] as const) {
			renderTrail([area, folder, last]);

			const [first, second, third] = items();
			for (const item of [first, second]) {
				expect(item).toHaveClass("min-w-0", "shrink-0", "max-w-40");
				expect(item?.querySelector("a")).toHaveClass("min-w-0");
				expect(item?.querySelector("a > span")).toHaveClass("truncate");
			}
			// The last step has no width of its own to keep: it gives way.
			expect(third).toHaveClass("min-w-0", "shrink");
			expect(third?.className).not.toContain("shrink-0");
			expect(third?.className).not.toContain("max-w-40");
			if (last.text !== null) {
				expect(
					third?.querySelector('[aria-current="page"]'),
				).toHaveClass("truncate");
			}
			cleanup();
		}
	});

	it("leaves the area itself out below 768 px, with the mark after it, when there is more to show", () => {
		renderTrail([area, folder, { key: "m", text: "Hello", current: true }]);

		expect(items()[0]).toHaveClass("max-md:hidden");
		expect(separators()[0]).toHaveClass("max-md:hidden");
		expect(items()[1]).not.toHaveClass("max-md:hidden");
		expect(separators()[1]).not.toHaveClass("max-md:hidden");
	});

	it("keeps a trail of one step whole at every width", () => {
		renderTrail([{ ...area, current: true }]);

		expect(items()).toHaveLength(1);
		expect(items()[0]).not.toHaveClass("max-md:hidden");
		expect(separators()).toHaveLength(0);
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
