import { describe, expect, it } from "bun:test";

import { queuePageSchema } from ".";

describe("queuePageSchema", () => {
	it("parses a page with a cursor", () => {
		const parsed = queuePageSchema.parse({
			entries: [
				{
					id: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0e",
					reverse_path: "sender@example.org",
					recipients: ["rcpt@elsewhere.example"],
				},
			],
			next_cursor: "01890a5d-ac96-774b-b9aa-9be4c3bd6b0f",
		});
		expect(parsed.next_cursor).toBeDefined();
	});

	it("parses the last page without a cursor", () => {
		const parsed = queuePageSchema.parse({ entries: [] });
		expect(parsed.next_cursor).toBeUndefined();
	});

	it("rejects non-UUID entry ids", () => {
		expect(() =>
			queuePageSchema.parse({
				entries: [{ id: "nope", reverse_path: "", recipients: [] }],
			}),
		).toThrow();
	});
});
