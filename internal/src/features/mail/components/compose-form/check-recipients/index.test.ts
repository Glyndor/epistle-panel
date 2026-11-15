import { describe, expect, it } from "bun:test";

import { checkRecipients } from ".";

const values = (over: Partial<Record<"to" | "cc" | "bcc", string>> = {}) => ({
	to: "",
	cc: "",
	bcc: "",
	...over,
});

describe("checkRecipients", () => {
	it("reads the addresses of the three fields and finds nothing wrong", () => {
		const { parsed, problems } = checkRecipients(
			values({
				to: "a@example.test",
				cc: "b@example.test",
				bcc: "c@example.test",
			}),
			"send",
		);

		expect(problems).toEqual([]);
		expect(parsed.to.recipients).toHaveLength(1);
		expect(parsed.cc.recipients).toHaveLength(1);
		expect(parsed.bcc.recipients).toHaveLength(1);
	});

	it("names the pieces that are not addresses, in the field that holds them, for a draft as for a send", () => {
		for (const op of ["draft", "send"] as const) {
			const { problems } = checkRecipients(
				values({
					to: "a@example.test",
					cc: "nobody, other@example.test",
				}),
				op,
			);
			expect(problems).toEqual([
				{ field: "cc", kind: "invalid", list: "nobody" },
			]);
		}
	});

	it("asks a send for somebody to send to, and a draft for nothing", () => {
		expect(checkRecipients(values(), "send").problems).toEqual([
			{ field: "to", kind: "none" },
		]);
		expect(checkRecipients(values(), "draft").problems).toEqual([]);
	});

	it("does not ask for somebody as well when a field is already refused", () => {
		const { problems } = checkRecipients(values({ to: "nobody" }), "send");

		expect(problems).toEqual([
			{ field: "to", kind: "invalid", list: "nobody" },
		]);
	});

	it("counts the copies and the hidden copies as somebody", () => {
		expect(
			checkRecipients(values({ bcc: "c@example.test" }), "send").problems,
		).toEqual([]);
	});
});
