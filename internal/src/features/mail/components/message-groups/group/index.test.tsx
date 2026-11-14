import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, within } from "@testing-library/react";

import { withQuery } from "@/test/query-wrapper";
import { summary } from "../../../test-support/fixtures";

import { Group } from ".";

afterEach(cleanup);

const view = {
	box: "INBOX",
	role: "inbox",
	page: 1,
	filter: "all",
	q: "",
} as const;
const A = "00000000-0000-4000-8000-000000000001";
const B = "00000000-0000-4000-8000-000000000002";
const rows = [
	summary({ id: A, subject: "first", receivedAt: "2026-11-13T09:00:00Z" }),
	summary({ id: B, subject: "second", receivedAt: "2026-11-13T08:00:00Z" }),
];

function group(selectedId: string | undefined = undefined) {
	return render(
		withQuery(
			<Group
				group={{ kind: "today" }}
				rows={rows}
				selectedId={selectedId}
				view={view}
			/>,
		),
	);
}

describe("Group", () => {
	it("is a heading of the level under the list's own and the list it names, in the order given", () => {
		group();
		const heading = screen.getByRole("heading", { level: 3 });
		const list = screen.getByRole("list");

		expect(heading).toHaveTextContent("groupToday");
		expect(list).toHaveAttribute("aria-labelledby", heading.id);
		expect(
			within(list)
				.getAllByRole("listitem")
				.map((row) => row.querySelector("a")?.dataset["messageId"]),
		).toEqual([A, B]);
	});

	it("says which date group it is, for whoever looks for the run", () => {
		const { container } = group();

		expect(container.firstElementChild).toHaveAttribute(
			"data-slot",
			"message-group",
		);
		expect(container.firstElementChild).toHaveAttribute(
			"data-group",
			"today",
		);
	});

	it("keeps its heading at the top while its rows scroll, on the pane's surface, as tall as the pane's scroll padding", () => {
		group();

		expect(screen.getByRole("heading", { level: 3 })).toHaveClass(
			"sticky",
			"top-0",
			"h-8",
			"bg-surface",
		);
	});

	it("marks the open message and no other, and separates rows with space alone", () => {
		const { container } = group(B);

		expect(
			Array.from(container.querySelectorAll("li")).map(
				(row) => row.dataset["open"],
			),
		).toEqual(["false", "true"]);
		expect(screen.getByRole("list")).toHaveClass("gap-1");
		expect(container.innerHTML).not.toMatch(/border|divide/);
	});
});
