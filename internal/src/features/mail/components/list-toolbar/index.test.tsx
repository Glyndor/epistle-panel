import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { ListToolbar } from ".";

afterEach(cleanup);

describe("ListToolbar", () => {
	it("is a plain GET form to the folder's own page that keeps the filter", () => {
		const { container } = render(
			<ListToolbar
				box="Work/Q4"
				folderRole={null}
				filter="unread"
				q=""
			/>,
		);
		const form = container.querySelector("form");
		expect(form).toHaveAttribute("method", "get");
		expect(form).toHaveAttribute("action", "/app/mail/folder/Work_2FQ4");
		// The folder is the path: no field names it.
		expect(form?.querySelector("input[name=box]")).toBeNull();
		expect(form?.querySelector("input[name=filter]")).toHaveValue("unread");
		const search = screen.getByRole("searchbox");
		expect(search).toHaveAttribute("name", "q");
		expect(search).toHaveAttribute("aria-keyshortcuts", "/");
		expect(search).toHaveAttribute("maxlength", "200");
	});

	it("posts the search of a folder with a role to the role's page", () => {
		const { container } = render(
			<ListToolbar box="Papelera" folderRole="trash" filter="all" q="" />,
		);
		expect(container.querySelector("form")).toHaveAttribute(
			"action",
			"/app/mail/trash",
		);
	});

	it("sends no filter field for the default filter and no clear link without a search", () => {
		const { container } = render(
			<ListToolbar box="INBOX" folderRole="inbox" filter="all" q="" />,
		);
		expect(container.querySelector("input[name=filter]")).toBeNull();
		expect(screen.queryByRole("link", { name: "searchClear" })).toBeNull();
		expect(screen.queryByText("searchNote")).toBeNull();
	});

	it("shows the search, says what it reads and offers to clear it", () => {
		render(
			<ListToolbar
				box="INBOX"
				folderRole="inbox"
				filter="flagged"
				q="invoice"
			/>,
		);
		expect(screen.getByRole("searchbox")).toHaveValue("invoice");
		expect(screen.getByText("searchNote")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "searchClear" }),
		).toHaveAttribute("href", "/app/mail/inbox?filter=flagged");
	});

	it("lists the filters as links that keep the search and mark the current one", () => {
		render(
			<ListToolbar
				box="INBOX"
				folderRole="inbox"
				filter="unread"
				q="a b"
			/>,
		);
		const nav = screen.getByRole("navigation", { name: "filtersLabel" });
		const links = Array.from(nav.querySelectorAll("a"));
		expect(links.map((l) => l.textContent)).toEqual([
			"filterAll",
			"filterUnread",
			"filterFlagged",
			"filterAttachments",
		]);
		expect(links[2]?.getAttribute("href")).toBe(
			"/app/mail/inbox?filter=flagged&q=a+b",
		);
		expect(
			links.filter((l) => l.getAttribute("aria-current") === "true"),
		).toHaveLength(1);
		expect(links[1]).toHaveAttribute("aria-current", "true");
	});
});
