import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { MailSearch } from ".";

afterEach(cleanup);

/** The search of the header, with what the address holds. */
async function search(props: Partial<Parameters<typeof MailSearch>[0]> = {}) {
	return render(
		await MailSearch({
			box: "INBOX",
			role: "inbox",
			q: "",
			filter: "all",
			...props,
		}),
	);
}

describe("MailSearch", () => {
	it("is a plain GET form to the folder's own page that keeps the filter", async () => {
		const { container } = await search({ filter: "unread" });
		const form = container.querySelector("form");
		expect(form).toHaveAttribute("method", "get");
		expect(form).toHaveAttribute("action", "/app/mail/inbox");
		// The folder is the path: no field names it.
		expect(form?.querySelector("input[name=box]")).toBeNull();
		expect(form?.querySelector("input[name=filter]")).toHaveValue("unread");
		const field = screen.getByRole("searchbox");
		expect(field).toHaveAttribute("name", "q");
		expect(field).toHaveAttribute("aria-keyshortcuts", "/");
		expect(field).toHaveAttribute("maxlength", "200");
	});

	it("says in the placeholder what the search reads", async () => {
		await search();

		expect(screen.getByRole("searchbox")).toHaveAttribute(
			"placeholder",
			"searchPlaceholder",
		);
	});

	it("draws the search icon inside the start of the field", async () => {
		const { container } = await search();

		const icon = container.querySelector("form svg");
		expect(icon).toBeInTheDocument();
		expect(icon?.getAttribute("aria-hidden")).toBe("true");
		expect(icon?.getAttribute("class")).toContain("start-3");
	});

	it("names the search button, an icon alone, in a tooltip", async () => {
		await search();

		fireEvent.pointerEnter(
			screen.getByRole("button", { name: "searchSubmit" }),
		);

		expect(
			document.querySelector("[data-slot='tooltip']"),
		).toHaveTextContent("searchSubmit");
	});

	it("posts the search of a folder with a role to the role's page", async () => {
		const { container } = await search({ box: "Papelera", role: "trash" });

		expect(container.querySelector("form")).toHaveAttribute(
			"action",
			"/app/mail/trash",
		);
	});

	it("sends no filter field for the default filter", async () => {
		const { container } = await search();

		expect(container.querySelector("input[name=filter]")).toBeNull();
	});

	it("shows the words the address holds", async () => {
		await search({ q: "invoice" });

		expect(screen.getByRole("searchbox")).toHaveValue("invoice");
	});
});
