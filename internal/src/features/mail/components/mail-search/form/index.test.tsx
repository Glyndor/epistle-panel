import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { forgetListMemory } from "@/features/mail/components/message-list/list-memory";

import { parseListConditions } from "@/features/mail/schemas/list-conditions";
import {
	EMPTY_CONDITIONS,
	type ListConditions,
	MAX_CONDITION_TEXT,
} from "@/features/mail/schemas/list-conditions-model";
import { registerStandIn } from "@/test/next-intl";
import { navigationStandIn } from "@/test/next-navigation";
import { withQuery } from "@/test/query-wrapper";

/** The addresses the search sent the browser to. */
const pushed: string[] = [];

mock.module("next/navigation", () => ({
	useRouter: () => ({
		push: (href: string) => {
			pushed.push(href);
		},
		replace: () => {},
		refresh: () => {},
	}),
}));

const { SearchForm } = await import(".");

afterEach(() => {
	cleanup();
	forgetListMemory();
	pushed.length = 0;
});

// The router of the form is this file's own: the stand-in goes back in place
// so the files that run after this one find the panel's own.
afterAll(() => {
	registerStandIn("next/navigation", navigationStandIn);
});

const char = (code: number) => String.fromCodePoint(code);

/** The form of the search, with what the address holds. */
function draw(
	conditions: Partial<ListConditions> = {},
	path = "/app/mail/inbox",
) {
	const { container } = render(
		withQuery(
			<SearchForm
				path={path}
				conditions={{ ...EMPTY_CONDITIONS, ...conditions }}
			/>,
		),
	);
	return {
		container,
		form: container.querySelector("form") as HTMLFormElement,
	};
}

/** A field of the panel, by the name of its label. */
const field = (name: string) =>
	screen.getByLabelText(name) as HTMLInputElement | HTMLSelectElement;

/** The field of the words. */
const words = () => screen.getByRole("searchbox") as HTMLInputElement;

/**
 * The button that opens the panel of the fields: the summary of the
 * browser's own disclosure.
 */
const panelButton = () =>
	screen.getByText("searchFields").closest("summary") as HTMLElement;

/** The disclosure that holds the fields. */
const disclosure = () => panelButton().closest("details") as HTMLDetailsElement;

/** Write a value in a field, as a person typing would. */
function write(name: string, value: string) {
	fireEvent.change(field(name), { target: { value } });
}

/** Open the panel of the fields, so what they say is seen. */
function openPanel() {
	fireEvent.click(panelButton());
}

/** The address the form sends, as a browser would build it. */
function address(form: HTMLFormElement): URLSearchParams {
	const params = new URLSearchParams();
	new FormData(form).forEach((value, name) => {
		params.append(name, String(value));
	});
	return params;
}

describe("the search form", () => {
	it("is a plain GET form to the folder's own page", () => {
		const { form } = draw();

		expect(form).toHaveAttribute("method", "get");
		expect(form).toHaveAttribute("action", "/app/mail/inbox");
		// Without script the browser sends the form itself, and the address
		// it builds is the one the page reads.
		expect(pushed).toEqual([]);
	});

	it("sends the search as a change of the address, so the page is drawn again and the field keeps the focus", () => {
		const { form } = draw();
		fireEvent.change(words(), { target: { value: "invoice" } });

		expect(fireEvent.submit(form)).toBe(false);

		// The browser did not reload the page: the address changed and the
		// page is drawn again with what it says.
		expect(pushed).toHaveLength(1);
		expect(pushed[0]).toStartWith("/app/mail/inbox?");
		expect(pushed[0]).toContain("q=invoice");
	});

	it("keeps what the list was narrowed by in the address of a new search", () => {
		const { form } = draw({ unread: true, order: "oldest" });

		expect(fireEvent.submit(form)).toBe(false);

		expect(pushed).toHaveLength(1);
		expect(pushed[0]).toContain("unread=1");
		expect(pushed[0]).toContain("order=oldest");
	});

	it("posts to the page of the folder it was drawn for", () => {
		const { form } = draw({}, "/app/mail/folder/Work_2FQ4");

		expect(form).toHaveAttribute("action", "/app/mail/folder/Work_2FQ4");
	});

	it("writes an address the server reads back as the same search", () => {
		const { form } = draw({ folder: "Work/Q4" });
		write("from", "ana");
		write("to", "bel");
		write("fieldSubject", "Q3");
		write("conditionAfter", "2026-11-01");
		write("conditionBefore", "2026-11-10");
		write("conditionLabel", "Work");
		fireEvent.change(words(), { target: { value: "invoice" } });
		fireEvent.click(field("hasAttachment"));

		const sent = address(form);
		const parsed = parseListConditions(Object.fromEntries(sent));

		expect(parsed.rejected).toEqual([]);
		expect(parsed.conditions).toEqual({
			...EMPTY_CONDITIONS,
			q: "invoice",
			from: "ana",
			to: "bel",
			subject: "Q3",
			after: "2026-11-01",
			before: "2026-11-10",
			label: "Work",
			folder: "Work/Q4",
			attachment: true,
		});
	});

	it("names a value over the limit and sends nothing", () => {
		const { form } = draw();
		openPanel();
		write("from", "a".repeat(201));

		// Nothing is sent: the browser's own check let it through, so the
		// page stops it and says what is wrong.
		expect(fireEvent.submit(form)).toBe(false);

		const message = screen.getByRole("alert");
		expect(message).toHaveTextContent("conditionTooLong");
		// The field says that it is the one that is wrong, and points at the
		// message.
		expect(field("from")).toHaveAttribute("aria-invalid", "true");
		expect(field("from")).toHaveAttribute(
			"aria-describedby",
			"mail-condition-from-message",
		);
		expect(message).toHaveAttribute("id", "mail-condition-from-message");
		// The value was not cut short to make it fit.
		expect(field("from")).toHaveValue("a".repeat(201));
	});

	it("names a hostile text and sends nothing", () => {
		const { form } = draw();
		openPanel();
		write("from", `ana${char(0x00)}bel`);

		expect(fireEvent.submit(form)).toBe(false);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"conditionInvalidText",
		);
		expect(field("from")).toHaveAttribute("aria-invalid", "true");
	});

	it("names a day the schema does not take and sends nothing", () => {
		const { form } = draw();
		openPanel();
		// A day of the calendar, but one the schema does not name: the
		// years a condition names start at 1970.
		write("conditionAfter", "1969-12-31");

		expect(fireEvent.submit(form)).toBe(false);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"conditionInvalidDay",
		);
		expect(field("conditionAfter")).toHaveAttribute("aria-invalid", "true");
	});

	it("refuses a range whose first day is later than its last", () => {
		const { form } = draw();
		openPanel();
		write("conditionAfter", "2026-11-10");
		write("conditionBefore", "2026-11-01");

		expect(fireEvent.submit(form)).toBe(false);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"conditionInvalidRange",
		);
	});

	it("refuses a label the server would not keep", () => {
		const { form } = draw();
		openPanel();
		write("conditionLabel", "$seen");

		expect(fireEvent.submit(form)).toBe(false);
		expect(screen.getByRole("alert")).toHaveTextContent(
			"conditionInvalidLabel",
		);
		expect(field("conditionLabel")).toHaveAttribute("aria-invalid", "true");
	});

	it("names the words when they are over the limit and sends nothing", () => {
		const { form } = draw();
		fireEvent.change(words(), { target: { value: "a".repeat(201) } });

		expect(fireEvent.submit(form)).toBe(false);

		const message = screen.getByRole("alert");
		expect(message).toHaveTextContent("conditionTooLong");
		expect(words()).toHaveAttribute("aria-invalid", "true");
		expect(words()).toHaveAttribute(
			"aria-describedby",
			"mail-search-words-message",
		);
		expect(message).toHaveAttribute("id", "mail-search-words-message");
		expect(words()).toHaveAttribute(
			"maxlength",
			String(MAX_CONDITION_TEXT + 1),
		);
		expect(words()).toHaveValue("a".repeat(201));
	});

	it("echoes nothing of what was written as markup", () => {
		const { container, form } = draw();
		openPanel();
		const hostile = '<script>alert("x")</script>';
		write("from", hostile);

		fireEvent.submit(form);

		// The value is text in the page, never markup: it is a text of a
		// search, and the page says nothing about it.
		expect(container.querySelector("script")).toBeNull();
		expect(container.innerHTML).not.toContain("<script");
		expect(field("from")).toHaveValue(hostile);
	});

	it("says what is wrong without echoing what was written", () => {
		const { form } = draw();
		openPanel();
		const hostile = `<script>alert("x")</script>${char(0x00)}`;

		write("from", hostile);
		fireEvent.submit(form);

		// The message names the field, not the value: nothing of what was
		// written reaches the page.
		const message = screen.getByRole("alert");
		expect(message).toHaveTextContent("conditionInvalidText");
		expect(message.textContent).not.toContain("script");
		expect(message.textContent).not.toContain("alert");
	});

	it("writes the words of the address into the field, escaped", () => {
		const html = renderToString(
			withQuery(
				<SearchForm
					path="/app/mail/inbox"
					conditions={{
						...EMPTY_CONDITIONS,
						q: '<script>alert("x")</script>',
					}}
				/>,
			),
		);

		// The server writes the value into the field: as text, never as
		// markup.
		expect(html).toContain("&lt;script&gt;");
		expect(html).not.toContain("<script>");
	});

	it("keeps the fields in the page while the panel is closed, so a search keeps what was typed in them", () => {
		const { form } = draw();

		// The fields are inside the browser's own disclosure: while it is
		// closed it takes them out of sight and out of the tab order, and it
		// does it without any script.
		expect(disclosure().open).toBe(false);
		expect(disclosure().contains(field("from"))).toBe(true);

		write("from", "ana");
		const sent = address(form);
		expect(sent.get("from")).toBe("ana");

		openPanel();
		expect(disclosure().open).toBe(true);
	});

	it("opens and closes the panel of the fields", () => {
		draw();

		expect(disclosure().open).toBe(false);
		openPanel();
		expect(disclosure().open).toBe(true);
		fireEvent.click(panelButton());
		expect(disclosure().open).toBe(false);
	});

	it("opens the fields with the browser's own button, before any script has loaded", () => {
		const html = renderToString(
			withQuery(
				<SearchForm
					path="/app/mail/inbox"
					conditions={EMPTY_CONDITIONS}
				/>,
			),
		);

		// What the browser gets before any script runs: a disclosure with a
		// summary in it and the fields inside. The browser opens and closes
		// it on its own, with no script of the panel's.
		expect(html).toContain("<details");
		expect(html).toContain("<summary");
		expect(html).toContain('name="from"');
		expect(html).toContain('name="subject"');
	});
});
