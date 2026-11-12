import { afterEach, describe, expect, it } from "bun:test";

import {
	BRAND_FAVICON_VARIABLE,
	BRAND_LOGO_VARIABLE,
	BRAND_NAME_VARIABLE,
	getBrand,
} from ".";

afterEach(() => {
	for (const name of [
		BRAND_NAME_VARIABLE,
		BRAND_LOGO_VARIABLE,
		BRAND_FAVICON_VARIABLE,
	]) {
		delete process.env[name];
	}
});

describe("getBrand", () => {
	it("is the default product with no images when nothing is set", () => {
		expect(getBrand()).toEqual({
			name: "Epistle",
			hasLogo: false,
			hasFavicon: false,
		});
	});

	it("uses the operator's name, trimmed, and notes which images are configured", () => {
		process.env[BRAND_NAME_VARIABLE] = "  Acme Mail ";
		process.env[BRAND_LOGO_VARIABLE] = "/run/logo.svg";

		expect(getBrand()).toEqual({
			name: "Acme Mail",
			hasLogo: true,
			hasFavicon: false,
		});
	});

	it("falls back to the default for an invalid name instead of failing", () => {
		for (const bad of ["", "   ", "a\nb", "x".repeat(41)]) {
			process.env[BRAND_NAME_VARIABLE] = bad;
			expect(getBrand().name).toBe("Epistle");
		}
	});
});
