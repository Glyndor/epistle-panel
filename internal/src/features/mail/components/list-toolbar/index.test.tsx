import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

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
				density="comfortable"
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

	it("names the search button, an icon alone, in a tooltip", () => {
		render(
			<ListToolbar
				box="INBOX"
				folderRole="inbox"
				filter="all"
				q=""
				density="comfortable"
			/>,
		);

		fireEvent.pointerEnter(
			screen.getByRole("button", { name: "searchSubmit" }),
		);

		expect(
			document.querySelector("[data-slot='tooltip']"),
		).toHaveTextContent("searchSubmit");
	});

	it("posts the search of a folder with a role to the role's page", () => {
		const { container } = render(
			<ListToolbar
				box="Papelera"
				folderRole="trash"
				filter="all"
				q=""
				density="comfortable"
			/>,
		);
		expect(container.querySelector("form")).toHaveAttribute(
			"action",
			"/app/mail/trash",
		);
	});

	it("sends no filter field for the default filter and no clear link without a search", () => {
		const { container } = render(
			<ListToolbar
				box="INBOX"
				folderRole="inbox"
				filter="all"
				q=""
				density="comfortable"
			/>,
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
				density="comfortable"
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
				density="comfortable"
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

	it("keeps the filters on one line in any language: they scroll sideways and never wrap", () => {
		render(
			<ListToolbar
				box="INBOX"
				folderRole="inbox"
				filter="all"
				q=""
				density="comfortable"
			/>,
		);
		const list = screen
			.getByRole("navigation", { name: "filtersLabel" })
			.querySelector("ul");

		expect(list).toHaveClass("flex", "overflow-x-auto");
		expect(list).not.toHaveClass("flex-wrap");
		// Room for a chip's focus ring inside the box that clips it.
		expect(list).toHaveClass("p-1", "-m-1");
		for (const item of Array.from(list?.children ?? [])) {
			expect(item).toHaveClass("shrink-0");
			expect(item.querySelector("a")).toHaveClass("whitespace-nowrap");
		}
	});

	it("gives the filters 10 px of side padding with a fine pointer, which is what fits the four at 360 px", () => {
		render(
			<ListToolbar
				box="INBOX"
				folderRole="inbox"
				filter="all"
				q=""
				density="comfortable"
			/>,
		);

		// Measured: with 12 px the four are 334 px in Italian and 330 px in
		// Portuguese, in a strip of 328 px, and the last is cut at rest.
		for (const filter of screen
			.getByRole("navigation", { name: "filtersLabel" })
			.querySelectorAll("a")) {
			const sides = filter.className
				.split(/\s+/)
				.filter((name) => /^(pointer-coarse:)?p[xse]?-/.test(name));
			expect(sides).toEqual(["px-2.5", "pointer-coarse:px-3"]);
		}
	});

	it("gives every filter a look under the pointer and another under a press, the one in use included", () => {
		render(
			<ListToolbar
				box="INBOX"
				folderRole="inbox"
				filter="unread"
				q=""
				density="comfortable"
			/>,
		);
		const fills = (name: string) =>
			screen
				.getByRole("link", { name })
				.className.split(/\s+/)
				.filter((one) => /(^|:)bg-/.test(one))
				.sort();

		// Rest, pointer and press are three fills, and the filter in use has
		// its own three: before, its pointer fill was its rest fill.
		expect(fills("filterAll")).toEqual([
			"active:bg-foreground/20",
			"bg-muted",
			"hover:bg-foreground/15",
		]);
		expect(fills("filterUnread")).toEqual([
			"active:bg-foreground/25",
			"bg-accent",
			"hover:bg-foreground/20",
		]);
	});

	it("puts the density switch at the end of the search's line, in the density the server read", () => {
		for (const [density, pressed] of [
			["comfortable", "false"],
			["compact", "true"],
		] as const) {
			const { container } = render(
				<ListToolbar
					box="INBOX"
					folderRole="inbox"
					filter="all"
					q=""
					density={density}
				/>,
			);
			const toggle = screen.getByRole("button", {
				name: "densityCompact",
			});

			expect(toggle).toHaveAttribute("aria-pressed", pressed);
			// Beside the form and outside it; the filters have their line to themselves.
			const form = container.querySelector("form");
			expect(form?.parentElement).toBe(toggle.parentElement);
			expect(form?.contains(toggle)).toBe(false);
			expect(
				screen
					.getByRole("navigation", { name: "filtersLabel" })
					.contains(toggle),
			).toBe(false);
			expect(
				screen.getByRole("navigation", { name: "filtersLabel" })
					.parentElement === container.firstElementChild,
			).toBe(true);
			cleanup();
		}
	});
});
