import { describe, expect, it } from "bun:test";

import {
	formatRecipients,
	isAddress,
	MAX_RECIPIENTS,
	parseRecipients,
} from ".";

describe("isAddress", () => {
	it("accepts a plain address, non-ASCII included", () => {
		for (const a of ["a@example.org", "ana.perez+tag@exämple.org", "x@y"]) {
			expect(isAddress(a)).toBe(true);
		}
	});

	it("refuses what is not one address", () => {
		for (const a of [
			"",
			"a",
			"@b",
			"a@",
			"a@@b",
			"a b@c",
			"a@b c",
			"a@b\n",
			"a\u0000@b",
			"a‮@b",
			"a@b>",
			"<a@b>",
			"a,b@c",
			'"a"@b',
			"a@b.org\r\nBcc: x@y",
			`${"a".repeat(250)}@b.org`,
		]) {
			expect(isAddress(a), a).toBe(false);
		}
	});
});

describe("parseRecipients", () => {
	it("reads addresses separated by commas, semicolons and line breaks", () => {
		expect(
			parseRecipients("a@x.org, b@x.org;c@x.org\nd@x.org").recipients.map(
				(r) => r.email,
			),
		).toEqual(["a@x.org", "b@x.org", "c@x.org", "d@x.org"]);
	});

	it("reads Name <address>, dropping quotes and cleaning the name", () => {
		const { recipients } = parseRecipients(
			'Ana Pérez <ana@x.org>, "Bo, Jr" <bo@x.org>, Ev‮a\r <eva@x.org>, <cy@x.org>',
		);
		expect(recipients).toEqual([
			{ name: "Ana Pérez", email: "ana@x.org" },
			{ name: "Bo, Jr", email: "bo@x.org" },
			{ name: "Eva", email: "eva@x.org" },
			{ email: "cy@x.org" },
		]);
	});

	it("reports what is not an address as typed, and keeps the good ones", () => {
		const result = parseRecipients("a@x.org, nope, b@, Name <bad>");
		expect(result.recipients).toEqual([{ email: "a@x.org" }]);
		expect(result.invalid).toEqual(["nope", "b@", "Name <bad>"]);
	});

	it("is empty for nothing", () => {
		expect(parseRecipients("  ,; \n ")).toEqual({
			recipients: [],
			invalid: [],
		});
	});

	it("cuts a very long name", () => {
		expect(
			parseRecipients(`${"n".repeat(300)} <a@x.org>`).recipients[0]?.name,
		).toHaveLength(200);
	});

	it("has a ceiling constant of 100", () => {
		expect(MAX_RECIPIENTS).toBe(100);
	});
});

describe("formatRecipients", () => {
	it("writes them back as a field's text", () => {
		expect(
			formatRecipients([
				{ name: "Ana", email: "a@x.org" },
				{ email: "b@x.org" },
			]),
		).toBe("Ana <a@x.org>, b@x.org");
		expect(formatRecipients([])).toBe("");
	});
});
