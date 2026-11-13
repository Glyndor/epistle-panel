import { describe, expect, it } from "bun:test";

import { composeInputSchema } from ".";

const ID = "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e";
const ok = {
	op: "send",
	to: [{ email: "a@x.org" }],
	cc: [],
	bcc: [],
	subject: "Hi",
	text: "body",
	attachments: [],
};

describe("composeInputSchema", () => {
	it("accepts a message, a reply and a draft with attachments", () => {
		expect(composeInputSchema.safeParse(ok).success).toBe(true);
		expect(
			composeInputSchema.safeParse({
				...ok,
				op: "draft",
				draftId: ID,
				inReplyTo: "abc@x.org",
				references: ["abc@x.org"],
				attachments: [
					{
						blobId: "00000000-0000-4000-a000-000000000001",
						name: "a.pdf",
						type: "application/pdf",
					},
				],
			}).success,
		).toBe(true);
	});

	it("refuses an unknown field, a bad operation, a bad address, a long subject, a control in the subject and a bad blob or type", () => {
		for (const bad of [
			{ ...ok, extra: 1 },
			{ ...ok, op: "delete" },
			{ ...ok, to: [{ email: "nope" }] },
			{ ...ok, to: [{ email: "a@x.org", extra: 1 }] },
			{
				...ok,
				to: Array.from({ length: 101 }, () => ({ email: "a@x.org" })),
			},
			{ ...ok, subject: "x".repeat(999) },
			{ ...ok, subject: "a\r\nBcc: x@y.org" },
			{ ...ok, subject: "a‮b" },
			{ ...ok, text: "x".repeat(1_000_001) },
			{ ...ok, draftId: "../x" },
			{ ...ok, inReplyTo: "a b" },
			{ ...ok, inReplyTo: "<a>" },
			{
				...ok,
				attachments: [
					{
						blobId: "../../etc/passwd",
						name: "a",
						type: "text/plain",
					},
				],
			},
			{
				...ok,
				attachments: [
					{
						blobId: "00000000-0000-4000-a000-000000000001",
						name: "a",
						type: "text/html; charset=x",
					},
				],
			},
			{
				...ok,
				attachments: Array.from({ length: 21 }, () => ({
					blobId: "00000000-0000-4000-a000-000000000001",
					name: "a",
					type: "text/plain",
				})),
			},
			null,
			"x",
		]) {
			expect(composeInputSchema.safeParse(bad).success).toBe(false);
		}
	});
});
