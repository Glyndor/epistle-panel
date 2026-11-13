import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { ListPager } from ".";

afterEach(cleanup);
const view = { box: "INBOX", filter: "unread", q: "x" } as const;

describe("ListPager", () => {
	it("links to the next page only on the first page", () => {
		render(<ListPager view={view} page={1} hasNext total={120} />);
		expect(screen.queryByRole("link", { name: /newer/ })).toBeNull();
		expect(screen.getByRole("link", { name: /older/ })).toHaveAttribute(
			"href",
			"/app/mail?box=INBOX&page=2&filter=unread&q=x",
		);
	});

	it("links back on a middle page and not forward on the last", () => {
		render(<ListPager view={view} page={3} hasNext={false} total={120} />);
		expect(screen.getByRole("link", { name: /newer/ })).toHaveAttribute(
			"href",
			"/app/mail?box=INBOX&page=2&filter=unread&q=x",
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
			"/app/mail?box=INBOX&filter=unread&q=x",
		);
	});
});
