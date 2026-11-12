import { describe, expect, it } from "bun:test";

import { domainsSchema } from ".";

describe("domainsSchema", () => {
	it("parses a domain list", () => {
		expect(
			domainsSchema.parse({ domains: ["example.org"] }).domains,
		).toEqual(["example.org"]);
	});
});
