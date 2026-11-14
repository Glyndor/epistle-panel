import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { forgetListMemory } from "@/features/mail/components/message-list/list-memory";

import { parseListConditions } from "@/features/mail/schemas/list-conditions";
import {
	EMPTY_CONDITIONS,
	type ListConditions,
} from "@/features/mail/schemas/list-conditions-model";
import { withQuery } from "@/test/query-wrapper";

import { SearchForm } from ".";

afterEach(() => {
	cleanup();
	forgetListMemory();
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

/** Write a value in a field, as a person typing would. */
function write(name: string, value: string) {
	fireEvent.change(field(name), { target: { value } });
}

/** Open the panel of the fields, so what they say is seen. */
function openPanel() {
	fireEvent.click(screen.getByRole("button", { name: "searchFields" }));
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
		// A search that is valid is not stopped: the browser sends it.
		expect(fireEvent.submit(form)).toBe(true);
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

	it("sends nothing when the words are over the limit", () => {
		const { form } = draw();
		fireEvent.change(words(), { target: { value: "a".repeat(201) } });

		expect(fireEvent.submit(form)).toBe(false);
		// The words were not cut to make them fit.
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

	it("keeps the fields in the page while the panel is closed", () => {
		const { form } = draw();

		// The panel is closed, and the fields are still there: a search
		// keeps what was written in them.
		const button = screen.getByRole("button", { name: "searchFields" });
		expect(button).toHaveAttribute("aria-expanded", "false");
		expect(field("from")).toBeInTheDocument();
		write("from", "ana");

		const sent = address(form);
		expect(sent.get("from")).toBe("ana");
	});

	it("opens and closes the panel of the fields", () => {
		draw();
		const button = screen.getByRole("button", { name: "searchFields" });

		expect(button).toHaveAttribute("aria-expanded", "false");
		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "true");
		fireEvent.click(button);
		expect(button).toHaveAttribute("aria-expanded", "false");
	});
});
