import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";

import { MAX_CONDITION_TEXT } from "@/features/mail/schemas/list-conditions-model";
import { withQuery } from "@/test/query-wrapper";

import { SearchFields } from ".";

afterEach(cleanup);

/** The fields of the panel, with the errors the page found. */
function draw(
	errors: Record<string, string> = {},
	conditions: { label?: string | null } = {},
) {
	return render(
		withQuery(
			<SearchFields
				conditions={{
					q: "",
					from: "",
					to: "",
					subject: "",
					after: null,
					before: null,
					label: null,
					folder: null,
					unread: false,
					starred: false,
					important: false,
					attachment: false,
					order: "newest",
					...conditions,
				}}
				errors={errors}
			/>,
		),
	);
}

/** The field of a name, by the name of its label. */
const field = (name: string) =>
	screen.getByLabelText(name) as HTMLInputElement | HTMLSelectElement;

describe("the fields of the search", () => {
	it("are the eight of them, each with its name and its label", () => {
		draw();

		for (const [name, label] of [
			["from", "from"],
			["to", "to"],
			["subject", "fieldSubject"],
			["after", "conditionAfter"],
			["before", "conditionBefore"],
			["folder", "conditionFolder"],
			["label", "conditionLabel"],
			["attachment", "hasAttachment"],
		] as const) {
			const input = field(label);
			expect(input.getAttribute("name")).toBe(name);
			// The label names the field, so a click on it focuses it.
			expect(input.id).not.toBe("");
		}
	});

	it("declare the length of their schema, one character over", () => {
		draw();

		// The browser's own check is the first of the three: with one
		// character of room a cut paste is over the schema's limit, and the
		// page names it instead of taking it short.
		for (const label of ["from", "to", "fieldSubject"]) {
			expect(field(label)).toHaveAttribute(
				"maxlength",
				String(MAX_CONDITION_TEXT + 1),
			);
		}
		// A label is a keyword: at most 64 bytes.
		expect(field("conditionLabel")).toHaveAttribute("maxlength", "65");
	});

	it("leave the days to the browser, which takes a day and gives one back", () => {
		draw();

		for (const label of ["conditionAfter", "conditionBefore"]) {
			const input = field(label);
			expect(input).toHaveAttribute("type", "date");
			// A date field cannot take a paste of any size, so it declares
			// no length.
			expect(input.hasAttribute("maxlength")).toBe(false);
		}
	});

	it("say that they are the ones that are wrong, and point at the message", () => {
		draw({ from: "conditionTooLong" });

		const input = field("from");
		expect(input).toHaveAttribute("aria-invalid", "true");
		expect(input).toHaveAttribute(
			"aria-describedby",
			"mail-condition-from-message",
		);
		const message = screen.getByRole("alert");
		expect(message).toHaveAttribute("id", "mail-condition-from-message");
		expect(message).toHaveTextContent("conditionTooLong");
	});

	it("say nothing of the fields that are right", () => {
		draw({ from: "conditionTooLong" });

		for (const label of ["to", "fieldSubject", "conditionLabel"]) {
			const input = field(label);
			expect(input.hasAttribute("aria-invalid")).toBe(false);
			expect(input.hasAttribute("aria-describedby")).toBe(false);
		}
		expect(screen.getAllByRole("alert")).toHaveLength(1);
	});

	it("show no message for a message that is not the schema's", () => {
		// Only the schema's own messages are said: nothing else reaches the
		// page as text.
		draw({ from: "<script>alert(1)</script>" });

		expect(screen.queryByRole("alert")).toBeNull();
		expect(document.body.innerHTML).not.toContain("script");
		expect(document.body.innerHTML).not.toContain("alert(1)");
	});

	it("hold what the address holds", () => {
		draw({}, { label: "Work" });

		expect(field("conditionLabel")).toHaveValue("Work");
	});
});
