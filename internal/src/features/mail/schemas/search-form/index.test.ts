import { describe, expect, it } from "bun:test";

import { parseListConditions } from "@/features/mail/schemas/list-conditions";
import { MAX_CONDITION_TEXT } from "@/features/mail/schemas/list-conditions-model";

import {
	SEARCH_FORM_MESSAGES,
	type SearchFormValues,
	searchFormSchema,
	searchFormValues,
} from ".";

const char = (code: number) => String.fromCodePoint(code);

/** What the form holds when nothing was written in it. */
const BLANK: SearchFormValues = {
	q: "",
	from: "",
	to: "",
	subject: "",
	after: "",
	before: "",
	folder: "",
	label: "",
};

/** What the page's own check says about a set of values. */
function formVerdict(values: Partial<SearchFormValues>) {
	const data = new FormData();
	for (const [name, value] of Object.entries({ ...BLANK, ...values })) {
		data.set(name, value);
	}
	return searchFormSchema.safeParse(searchFormValues(data));
}

/** What the server says about the same values, read from an address. */
function serverVerdict(values: Partial<SearchFormValues>) {
	return parseListConditions({ ...values });
}

/**
 * The page's check and the server's check must accept and refuse the same
 * set: a value the page lets through and the server refuses leaves the
 * person with a search that silently does not narrow anything, and a value
 * the page refuses and the server accepts is a form that argues with the
 * server for no reason.
 */
function bothAgree(field: keyof SearchFormValues, value: string) {
	const form = formVerdict({ [field]: value }).success;
	const server = serverVerdict({ [field]: value }).rejected.length === 0;
	// The expectation repeats the server's verdict: a failure shows both.
	expect([field, value, form, server]).toEqual([
		field,
		value,
		server,
		server,
	]);
}

describe("the page's check and the server's check", () => {
	const TEXT = ["q", "from", "to", "subject"] as const;

	for (const field of TEXT) {
		it(`accept and refuse the same texts in ${field}`, () => {
			for (const value of [
				"",
				"invoice",
				"  invoice  ",
				"José Ñúñez",
				"Año",
				"a".repeat(MAX_CONDITION_TEXT),
				// One over the limit.
				"a".repeat(MAX_CONDITION_TEXT + 1),
				// Over the limit once the spaces around it are counted: the
				// length is of the value as written, not of the trimmed one.
				` ${"a".repeat(MAX_CONDITION_TEXT)} `,
				// A control, a line and a paragraph separator.
				`a${char(0x00)}b`,
				`a${char(0x09)}b`,
				`a${char(0x0a)}b`,
				`a${char(0x1b)}b`,
				`a${char(0x7f)}b`,
				`a${char(0x2028)}b`,
				`a${char(0x2029)}b`,
				// A hundred thousand characters.
				"a".repeat(100_000),
			]) {
				bothAgree(field, value);
			}
		});
	}

	it("accept and refuse the same days", () => {
		for (const field of ["after", "before"] as const) {
			for (const value of [
				"",
				"2026-11-01",
				"1970-01-01",
				"9999-12-31",
				// Not a day of the calendar.
				"2026-02-30",
				"2026-13-01",
				"2026-00-10",
				"2026-11-31",
				// Not the shape of a day.
				"2026-1-1",
				"2026-11-01T00:00:00Z",
				"01-11-2026",
				"not-a-day",
				"1969-12-31",
				"10000-01-01",
			]) {
				bothAgree(field, value);
			}
		}
	});

	it("accept and refuse the same folders", () => {
		for (const value of [
			"",
			"Work/Q4",
			"INBOX",
			// A control, a separator and a bidi control.
			`a${char(0x00)}b`,
			`a${char(0x0a)}b`,
			`a${char(0x2028)}b`,
			`a${char(0x202e)}b`,
			`a${char(0x2066)}b`,
			// Over the length of a mailbox id.
			"x".repeat(257),
		]) {
			bothAgree("folder", value);
		}
	});

	it("accept and refuse the same labels", () => {
		for (const value of [
			"",
			"Work",
			"To_20do",
			"A_C3_B1o",
			"a+b",
			"x".repeat(64),
			// Not a keyword the server would keep.
			"two words",
			"a(b",
			'a"b',
			"a\\b",
			"$seen",
			"$Important",
			"\\Seen",
			"Junk",
			"x".repeat(65),
			// A bidi mark is not part of a keyword.
			`a${char(0x202e)}b`,
		]) {
			bothAgree("label", value);
		}
	});

	it("refuse a range whose first day is later than its last, in both", () => {
		const form = formVerdict({ after: "2026-11-10", before: "2026-11-01" });
		const server = serverVerdict({
			after: "2026-11-10",
			before: "2026-11-01",
		});

		expect(form.success).toBe(false);
		expect(server.rejected).toEqual(["after", "before"]);
		// The same range the other way round is a range.
		expect(
			formVerdict({ after: "2026-11-01", before: "2026-11-10" }).success,
		).toBe(true);
		expect(
			serverVerdict({ after: "2026-11-01", before: "2026-11-10" })
				.rejected,
		).toEqual([]);
		// The same day on both ends is a day.
		expect(
			formVerdict({ after: "2026-11-01", before: "2026-11-01" }).success,
		).toBe(true);
	});

	it("names what is wrong with a value, with the message of the field", () => {
		const cases: [Partial<SearchFormValues>, string][] = [
			[{ q: "a".repeat(MAX_CONDITION_TEXT + 1) }, "conditionTooLong"],
			[{ from: `a${char(0x00)}b` }, "conditionInvalidText"],
			[{ subject: "a".repeat(100_000) }, "conditionTooLong"],
			[{ after: "2026-02-30" }, "conditionInvalidDay"],
			[{ before: "not-a-day" }, "conditionInvalidDay"],
			[{ folder: `a${char(0x00)}b` }, "conditionInvalidFolder"],
			[{ label: "$seen" }, "conditionInvalidLabel"],
			[
				{ after: "2026-11-10", before: "2026-11-01" },
				"conditionInvalidRange",
			],
		];
		for (const [values, message] of cases) {
			const parsed = formVerdict(values);
			const messages = parsed.success
				? []
				: parsed.error.issues.map((issue) => issue.message);
			expect(messages).toContain(message);
			// Every message it can give is one the page knows how to say.
			for (const said of messages) {
				expect(SEARCH_FORM_MESSAGES as readonly string[]).toContain(
					said,
				);
			}
		}
	});

	it("says the field that is wrong, not another one", () => {
		const parsed = formVerdict({
			subject: "a".repeat(MAX_CONDITION_TEXT + 1),
		});

		expect(parsed.success).toBe(false);
		if (parsed.success) {
			return;
		}
		expect(parsed.error.issues.map((issue) => issue.path[0])).toEqual([
			"subject",
		]);
	});

	it("reads the values out of the page, and a field it does not hold is empty", () => {
		const data = new FormData();
		data.set("q", "invoice");
		data.set("from", "ana");

		expect(searchFormValues(data)).toEqual({
			...BLANK,
			q: "invoice",
			from: "ana",
		});
	});
});
