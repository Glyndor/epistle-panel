import { expect, it } from "bun:test";
import { checkRecipients } from ".";

const addresses = (count: number) =>
	Array.from({ length: count }, (_, i) => `person${i}@example.org`).join(
		", ",
	);
it("enforces the default total across To Cc and Bcc", () => {
	for (const op of ["draft", "send"] as const)
		expect(
			checkRecipients(
				{ to: addresses(99), cc: addresses(1), bcc: addresses(1) },
				op,
			).problems,
		).toEqual([{ field: "bcc", kind: "tooMany" }]);
});
it.each(["to", "cc", "bcc"] as const)(
	"attributes a custom total overflow to %s",
	(field) => {
		const values = { to: "", cc: "", bcc: "" };
		if (field === "to") values.to = addresses(3);
		else {
			values.to = addresses(2);
			values[field] = addresses(1);
		}
		for (const op of ["draft", "send"] as const)
			expect(checkRecipients(values, op, 2).problems).toEqual([
				{ field, kind: "tooMany" },
			]);
	},
);
it("allows the exact total and counts parsed recipients rather than separators", () => {
	expect(
		checkRecipients(
			{
				to: '"Doe, Ana" <a@example.org>;',
				cc: "b@example.org",
				bcc: "c@example.org",
			},
			"send",
			3,
		).problems,
	).toEqual([]);
});
it("reports invalid addresses and total overflow together", () => {
	expect(
		checkRecipients(
			{ to: addresses(2), cc: "", bcc: "bad, c@example.org" },
			"send",
			2,
		).problems,
	).toEqual([
		{ field: "bcc", kind: "invalid", list: "bad" },
		{ field: "bcc", kind: "tooMany" },
	]);
});
