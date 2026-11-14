import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { withQuery } from "@/test/query-wrapper";
import { summary } from "../../test-support/fixtures";

import { MessageGroups } from ".";

afterEach(cleanup);

const TODAY = "2026-11-13";
const view = {
	box: "INBOX",
	role: "inbox",
	page: 1,
	filter: "all",
	q: "",
} as const;
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const at = (n: number, receivedAt: string, subject = `m${n}`) =>
	summary({ id: id(n), receivedAt, subject });

function groups(
	items: ReturnType<typeof summary>[],
	selectedId: string | undefined = undefined,
) {
	return render(
		withQuery(
			<MessageGroups
				items={items}
				today={TODAY}
				selectedId={selectedId}
				view={view}
			/>,
		),
	);
}
const headings = () =>
	screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);

describe("MessageGroups", () => {
	it("puts each run of messages under the heading of its date, in the server's order", () => {
		groups([
			at(1, "2026-11-13T09:00:00Z"),
			at(2, "2026-11-13T08:00:00Z"),
			at(3, "2026-11-12T23:59:00Z"),
			at(4, "2026-11-09T10:00:00Z"),
			at(5, "2026-10-20T10:00:00Z"),
			at(6, "2025-12-31T10:00:00Z"),
		]);

		// The test formatter prints the instant it was given: the first of the month, in UTC.
		expect(headings()).toEqual([
			"groupToday",
			"groupYesterday",
			"groupRecent",
			"2026-10-01T00:00:00.000Z",
			"2025-12-01T00:00:00.000Z",
		]);
		expect(
			within(screen.getByRole("list", { name: "groupToday" }))
				.getAllByRole("link")
				.map((link) => link.getAttribute("data-message-id")),
		).toEqual([id(1), id(2)]);
		expect(
			within(
				screen.getByRole("list", { name: "groupYesterday" }),
			).getAllByRole("link"),
		).toHaveLength(1);
	});

	it("names every list by a real heading one level under the list's own", () => {
		const { container } = groups([at(1, "2026-11-13T09:00:00Z")]);
		const own = screen.getByRole("heading", { level: 2 });
		const heading = screen.getByRole("heading", { level: 3 });
		const list = container.querySelector("ul");

		expect(own).toHaveTextContent("listLabel");
		expect(own).toHaveClass("sr-only");
		expect(heading.tagName).toBe("H3");
		expect(list).toHaveAttribute("aria-labelledby", heading.id);
		expect(heading.id).not.toBe("");
	});

	it("keeps a heading at the top while its run scrolls, on the pane's surface and with no line", () => {
		groups([at(1, "2026-11-13T09:00:00Z")]);
		const heading = screen.getByRole("heading", { level: 3 });

		expect(heading).toHaveClass("sticky", "top-0", "z-10", "bg-surface");
		// As tall as the pane's scroll padding (`scroll-pt-8`), so a focused row is never under it.
		expect(heading).toHaveClass("h-8");
		expect(heading.className).not.toMatch(/border|divide|shadow/);
		// It sticks only as far as its own run: the heading and its list share a box.
		expect(heading.parentElement).toBe(
			screen.getByRole("list", { name: "groupToday" }).parentElement,
		);
	});

	it("starts a new run for a message out of order and never moves it", () => {
		groups([
			at(1, "2026-11-13T09:00:00Z"),
			at(2, "2026-11-12T09:00:00Z"),
			at(3, "2026-11-13T07:00:00Z"),
		]);

		expect(headings()).toEqual([
			"groupToday",
			"groupYesterday",
			"groupToday",
		]);
		expect(
			screen
				.getAllByRole("link")
				.map((link) => link.getAttribute("data-message-id")),
		).toEqual([id(1), id(2), id(3)]);
	});

	it("has a row say the hour under today and yesterday and the day under the rest", () => {
		const { container } = groups([
			at(1, "2026-11-13T09:00:00Z"),
			at(2, "2026-11-12T09:00:00Z"),
			at(3, "2026-11-09T09:00:00Z"),
			at(4, "2026-09-09T09:00:00Z"),
		]);

		expect(
			Array.from(container.querySelectorAll("time")).map((time) =>
				time.getAttribute("data-date-part"),
			),
		).toEqual(["time", "time", "day", "day"]);
	});

	it("puts a message with no date under its own heading", () => {
		groups([at(1, "not a date")]);

		expect(headings()).toEqual(["groupUnknown"]);
	});

	it("marks the open message and no other", () => {
		groups(
			[at(1, "2026-11-13T09:00:00Z"), at(2, "2026-11-13T08:00:00Z")],
			id(2),
		);
		const [first, second] = screen.getAllByRole("link");

		expect(first).not.toHaveAttribute("aria-current");
		expect(second).toHaveAttribute("aria-current", "true");
	});

	it("separates rows and groups with space alone", () => {
		const { container } = groups([
			at(1, "2026-11-13T09:00:00Z"),
			at(2, "2026-11-12T09:00:00Z"),
		]);

		expect(container.querySelector("ul")).toHaveClass("gap-1");
		expect(container.firstElementChild).toHaveClass("gap-3");
		expect(container.querySelector("hr, [role=separator]")).toBeNull();
		expect(container.innerHTML).not.toMatch(
			/class="[^"]*\b(border|divide)-/,
		);
		expect(container.querySelector("[style]")).toBeNull();
	});
});
