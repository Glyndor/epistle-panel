import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";

import { ListPager } from ".";

afterEach(cleanup);
const view = {
	box: "Work/Q4",
	role: null,
	conditions: { ...EMPTY_CONDITIONS, unread: true, q: "x" },
} as const;

describe("ListPager", () => {
	it("links to the next page only on the first page", () => {
		render(<ListPager view={view} page={1} hasNext total={120} />);
		expect(screen.queryByRole("link", { name: /newer/ })).toBeNull();
		expect(screen.getByRole("link", { name: /older/ })).toHaveAttribute(
			"href",
			"/app/mail/folder/Work_2FQ4?page=2&q=x&unread=1",
		);
	});

	it("links back on a middle page and not forward on the last", () => {
		render(<ListPager view={view} page={3} hasNext={false} total={120} />);
		expect(screen.getByRole("link", { name: /newer/ })).toHaveAttribute(
			"href",
			"/app/mail/folder/Work_2FQ4?page=2&q=x&unread=1",
		);
		expect(screen.queryByRole("link", { name: /older/ })).toBeNull();
		expect(
			screen.getByRole("navigation", { name: "pagination" }),
		).toBeInTheDocument();
	});

	it("drops the page parameter when going back to the first", () => {
		render(<ListPager view={view} page={2} hasNext total={120} />);
		expect(screen.getByRole("link", { name: /newer/ })).toHaveAttribute(
			"href",
			"/app/mail/folder/Work_2FQ4?q=x&unread=1",
		);
	});
});
