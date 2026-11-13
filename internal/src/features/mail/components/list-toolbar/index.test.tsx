import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { ListToolbar } from ".";

afterEach(cleanup);

describe("ListToolbar", () => {
	it("is a plain GET form to the mail page that keeps the folder and filter", () => {
		const { container } = render(
			<ListToolbar box="Work/Q4" filter="unread" q="" />,
		);
		const form = container.querySelector("form");
		expect(form).toHaveAttribute("method", "get");
		expect(form).toHaveAttribute("action", "/app/mail");
		expect(form?.querySelector("input[name=box]")).toHaveValue("Work/Q4");
		expect(form?.querySelector("input[name=filter]")).toHaveValue("unread");
		const search = screen.getByRole("searchbox");
		expect(search).toHaveAttribute("name", "q");
		expect(search).toHaveAttribute("aria-keyshortcuts", "/");
		expect(search).toHaveAttribute("maxlength", "200");
	});

	it("sends no filter field for the default filter and no clear link without a search", () => {
		const { container } = render(
			<ListToolbar box="INBOX" filter="all" q="" />,
		);
		expect(container.querySelector("input[name=filter]")).toBeNull();
		expect(screen.queryByRole("link", { name: "searchClear" })).toBeNull();
		expect(screen.queryByText("searchNote")).toBeNull();
	});

	it("shows the search, says what it reads and offers to clear it", () => {
		render(<ListToolbar box="INBOX" filter="flagged" q="invoice" />);
		expect(screen.getByRole("searchbox")).toHaveValue("invoice");
		expect(screen.getByText("searchNote")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "searchClear" }),
		).toHaveAttribute("href", "/app/mail?box=INBOX&filter=flagged");
	});

	it("lists the filters as links that keep the search and mark the current one", () => {
		render(<ListToolbar box="INBOX" filter="unread" q="a b" />);
		const nav = screen.getByRole("navigation", { name: "filtersLabel" });
		const links = Array.from(nav.querySelectorAll("a"));
		expect(links.map((l) => l.textContent)).toEqual([
			"filterAll",
			"filterUnread",
			"filterFlagged",
			"filterAttachments",
		]);
		expect(links[2]?.getAttribute("href")).toBe(
			"/app/mail?box=INBOX&filter=flagged&q=a+b",
		);
		expect(
			links.filter((l) => l.getAttribute("aria-current") === "true"),
		).toHaveLength(1);
		expect(links[1]).toHaveAttribute("aria-current", "true");
	});
});
