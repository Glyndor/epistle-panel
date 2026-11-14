import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { forgetListMemory } from "@/features/mail/components/message-list/list-memory";
import { useMailShortcuts } from "@/features/mail/components/message-list/use-mail-shortcuts";
import { EMPTY_CONDITIONS } from "@/features/mail/schemas/list-conditions-model";
import { withQuery } from "@/test/query-wrapper";

import { MailSearch } from ".";

afterEach(() => {
	cleanup();
	forgetListMemory();
});

/** The list's own shortcut hook, the one the mail page mounts. */
function Shortcuts() {
	useMailShortcuts({ ids: [], selectedId: undefined });
	return null;
}

/** The search of the header, with what the address holds. */
async function search(props: Partial<Parameters<typeof MailSearch>[0]> = {}) {
	return render(
		withQuery(
			await MailSearch({
				box: "INBOX",
				role: "inbox",
				conditions: EMPTY_CONDITIONS,
				...props,
			}),
		),
	);
}

describe("MailSearch", () => {
	it("is a plain GET form to the folder's own page", async () => {
		const { container } = await search();
		const form = container.querySelector("form");
		expect(form).toHaveAttribute("method", "get");
		expect(form).toHaveAttribute("action", "/app/mail/inbox");
		// The folder is the path: no field names it.
		expect(form?.querySelector("input[name=box]")).toBeNull();
		const field = screen.getByRole("searchbox");
		expect(field).toHaveAttribute("name", "q");
		expect(field).toHaveAttribute("aria-keyshortcuts", "/");
		// One character over the schema's limit: a cut paste is over it, and
		// the server names it instead of taking it short.
		expect(field).toHaveAttribute("maxlength", "201");
	});

	it("carries the conditions that are not fields of its own", async () => {
		const { container } = await search({
			conditions: { ...EMPTY_CONDITIONS, unread: true, order: "oldest" },
		});
		expect(container.querySelector("input[name=unread]")).toHaveValue("1");
		expect(container.querySelector("input[name=order]")).toHaveValue(
			"oldest",
		);
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

	it("shows the words the address holds", async () => {
		await search({
			conditions: { ...EMPTY_CONDITIONS, q: "invoice" },
		});

		expect(screen.getByRole("searchbox")).toHaveValue("invoice");
	});

	it("is the field the `/` shortcut reaches, now that it is in the header", async () => {
		const element = await MailSearch({
			box: "INBOX",
			role: "inbox",
			conditions: EMPTY_CONDITIONS,
		});
		render(
			withQuery(
				<>
					<Shortcuts />
					{element}
				</>,
			),
		);

		fireEvent.keyDown(document.body, { key: "/" });

		// The field of the header, and not a field left somewhere else.
		expect(document.activeElement).toBe(screen.getByRole("searchbox"));
		expect(document.activeElement?.getAttribute("data-mail-search")).toBe(
			"",
		);
	});

	it("does not swallow a key typed in it", async () => {
		await search();
		const field = screen.getByRole("searchbox");
		field.focus();

		const notPrevented = fireEvent.keyDown(field, { key: "/" });

		// The key stays in the field: it is not a shortcut while the field
		// has the focus.
		expect(notPrevented).toBe(true);
	});
});
