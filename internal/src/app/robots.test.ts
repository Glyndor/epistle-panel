import { describe, expect, it } from "bun:test";

import robots from "./robots";

describe("robots.txt", () => {
	it("refuses every crawler for the whole site", () => {
		expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
	});

	it("names no sitemap and no allowed path", () => {
		const result = robots();

		expect(result.sitemap).toBeUndefined();
		expect(result.rules).not.toHaveProperty("allow");
	});
});
