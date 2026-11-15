import { afterEach, describe, expect, it } from "bun:test";

import { brandImagePath } from ".";

const KEY = "EPISTLE_PANEL_BRAND_ORIGIN";
const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});

describe("brandImagePath", () => {
	it("is the panel's own path with no brand origin", () => {
		delete process.env[KEY];
		expect(brandImagePath("logo")).toBe("/brand/logo");
		expect(brandImagePath("favicon")).toBe("/brand/favicon");
		process.env[KEY] = "  ";
		expect(brandImagePath("logo")).toBe("/brand/logo");
	});

	it("is the same path on the brand origin, normalised", () => {
		process.env[KEY] = "https://CDN.example.com:8443/";
		expect(brandImagePath("logo")).toBe(
			"https://cdn.example.com:8443/brand/logo",
		);
		expect(brandImagePath("favicon")).toBe(
			"https://cdn.example.com:8443/brand/favicon",
		);
	});

	it("falls back to the panel's own path for a value that is not an origin", () => {
		for (const value of [
			"http://cdn.example.com",
			"https://*.example.com",
			"https://cdn.example.com/x",
			"https://cdn.example.com;x",
			"x".repeat(5000),
		]) {
			process.env[KEY] = value;
			expect(brandImagePath("logo")).toBe("/brand/logo");
		}
	});
});
