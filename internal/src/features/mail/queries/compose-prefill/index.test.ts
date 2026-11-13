import { describe, expect, it } from "bun:test";

import type { EmailRecord } from "@/features/mail/jmap/responses";
import { composePrefill, MAX_QUOTE, type PrefillTexts } from ".";

const texts: PrefillTexts = {
	quoteHeader: (name, date) => `${name} wrote on ${date}:`,
	forwardHeader: "--- Forwarded ---",
	from: "From",
	to: "To",
	date: "Date",
	subject: "Subject",
};
const date = (iso: string) => `D(${iso})`;

const email = (over: Partial<EmailRecord> = {}): EmailRecord => ({
	id: "m1",
	receivedAt: "2026-11-12T10:00:00Z",
	subject: "Hello",
	from: [{ name: "Ana", email: "ana@x.org" }],
	to: [
		{ name: null, email: "me@x.org" },
		{ name: "Bo", email: "bo@x.org" },
	],
	cc: [{ name: null, email: "cy@x.org" }],
	textBody: [{ partId: "1", type: "text/plain" }],
	bodyValues: { "1": { value: "line one\nline two" } },
	messageId: ["<orig@x.org>"],
	...over,
});

describe("composePrefill: reply", () => {
	it("goes to the sender, quotes the text and links the thread", () => {
		const initial = composePrefill(
			"reply",
			email(),
			"me@x.org",
			texts,
			date,
		);
		expect(initial.to).toBe("Ana <ana@x.org>");
		expect(initial.cc).toBe("");
		expect(initial.subject).toBe("Re: Hello");
		expect(initial.text).toBe(
			"\n\nAna wrote on D(2026-11-12T10:00:00Z):\n> line one\n> line two",
		);
		expect(initial.inReplyTo).toBe("orig@x.org");
		expect(initial.references).toEqual(["orig@x.org"]);
	});

	it("prefers the reply-to address and does not stack a Re:", () => {
		const initial = composePrefill(
			"reply",
			email({
				subject: "RE: Hello",
				replyTo: [{ name: null, email: "list@x.org" }],
			}),
			undefined,
			texts,
			date,
		);
		expect(initial.to).toBe("list@x.org");
		expect(initial.subject).toBe("RE: Hello");
	});

	it("reply all adds the other recipients, never the account itself or the sender twice", () => {
		const initial = composePrefill(
			"replyAll",
			email({
				to: [
					{ email: "ME@x.org" },
					{ email: "ana@x.org" },
					{ email: "bo@x.org" },
				],
			}),
			"me@x.org",
			texts,
			date,
		);
		expect(initial.to).toBe("Ana <ana@x.org>");
		expect(initial.cc).toBe("bo@x.org, cy@x.org");
	});

	it("copes with a message with no sender, no id, no text and no date", () => {
		const initial = composePrefill(
			"reply",
			email({
				from: null,
				messageId: null,
				textBody: [],
				bodyValues: {},
				receivedAt: "x",
			}),
			undefined,
			texts,
			() => "",
		);
		expect(initial.to).toBe("");
		expect(initial.inReplyTo).toBeUndefined();
		expect(initial.references).toBeUndefined();
		expect(initial.text).toBe("\n\n wrote on :\n>");
	});

	it("quotes only cleaned text: line breaks, bidi and a hostile subject", () => {
		const initial = composePrefill(
			"reply",
			email({
				subject: "Hi‮\r\nBcc: x@y.org",
				bodyValues: { "1": { value: "a‮b\u0000c" } },
			}),
			undefined,
			texts,
			date,
		);
		expect(initial.subject).toBe("Re: Hi Bcc: x@y.org");
		expect(initial.text).toContain("> abc");
	});

	it("takes the text of an HTML-only message, without its markup, and cuts a very long one", () => {
		const html = composePrefill(
			"reply",
			email({
				textBody: [],
				htmlBody: [{ partId: "2", type: "text/html" }],
				bodyValues: {
					"2": { value: "<p>Hi <b>there</b></p><script>x</script>" },
				},
			}),
			undefined,
			texts,
			date,
		);
		expect(html.text).toContain("> Hi there");
		expect(html.text).not.toMatch(/script|<b>/u);
		const long = composePrefill(
			"reply",
			email({
				bodyValues: { "1": { value: "x".repeat(MAX_QUOTE * 2) } },
			}),
			undefined,
			texts,
			date,
		);
		expect(long.text.length).toBeLessThan(MAX_QUOTE + 200);
	});
});

describe("composePrefill: forward and draft", () => {
	it("forwards the original as text under its header lines, with no recipient and no thread", () => {
		const initial = composePrefill(
			"forward",
			email(),
			undefined,
			texts,
			date,
		);
		expect(initial.to).toBe("");
		expect(initial.subject).toBe("Fwd: Hello");
		expect(initial.text).toBe(
			"\n\n--- Forwarded ---\nFrom: Ana <ana@x.org>\nDate: D(2026-11-12T10:00:00Z)\nSubject: Hello\nTo: me@x.org, Bo <bo@x.org>\n\nline one\nline two",
		);
		expect(initial.inReplyTo).toBeUndefined();
	});

	it("gives a draft back as it was, with its attachments by blob id", () => {
		const initial = composePrefill(
			"draft",
			email({
				bcc: [{ email: "hid@x.org" }],
				attachments: [
					{
						partId: "2",
						blobId: "m1.2",
						type: "application/pdf",
						name: "a.pdf",
						size: 9,
					},
					{ partId: "3", blobId: null, type: "x/y", name: "gone" },
				],
			}),
			undefined,
			texts,
			date,
		);
		expect(initial).toMatchObject({
			to: "me@x.org, Bo <bo@x.org>",
			cc: "cy@x.org",
			bcc: "hid@x.org",
			subject: "Hello",
			draftId: "m1",
			text: "line one\nline two",
		});
		expect(initial.attachments).toEqual([
			{ blobId: "m1.2", name: "a.pdf", type: "application/pdf", size: 9 },
		]);
	});
});
