import { afterEach, describe, expect, it } from "bun:test";

import { BRAND_ORIGIN_VARIABLE } from "../brand-origin";
import { imageOrigins } from ".";

const BUILT = "PANEL_BUILT_STATIC_ORIGIN";
const saved = {
	built: process.env[BUILT],
	brand: process.env[BRAND_ORIGIN_VARIABLE],
};
const restore = (key: string, value: string | undefined) => {
	if (value === undefined) delete process.env[key];
	else process.env[key] = value;
};
afterEach(() => {
	restore(BUILT, saved.built);
	restore(BRAND_ORIGIN_VARIABLE, saved.brand);
});

describe("imageOrigins", () => {
	it("is empty when neither origin is set", () => {
		delete process.env[BUILT];
		delete process.env[BRAND_ORIGIN_VARIABLE];
		expect(imageOrigins()).toEqual([]);
		process.env[BRAND_ORIGIN_VARIABLE] = "  ";
		expect(imageOrigins()).toEqual([]);
	});

	it("lists the static origin of the build, then the brand origin", () => {
		process.env[BUILT] = "https://static.example.com";
		delete process.env[BRAND_ORIGIN_VARIABLE];
		expect(imageOrigins()).toEqual(["https://static.example.com"]);
		delete process.env[BUILT];
		process.env[BRAND_ORIGIN_VARIABLE] = "https://Brand.example.com:8443/";
		expect(imageOrigins()).toEqual(["https://brand.example.com:8443"]);
		process.env[BUILT] = "https://static.example.com";
		expect(imageOrigins()).toEqual([
			"https://static.example.com",
			"https://brand.example.com:8443",
		]);
	});

	it("names one origin once when both variables point at it", () => {
		process.env[BUILT] = "https://cdn.example.com";
		process.env[BRAND_ORIGIN_VARIABLE] = "https://CDN.example.com";
		expect(imageOrigins()).toEqual(["https://cdn.example.com"]);
	});

	it("leaves out a brand value that is not an origin, never widening the policy with it", () => {
		delete process.env[BUILT];
		for (const value of [
			"http://cdn.example.com",
			"https://*.example.com",
			"https://cdn.example.com;script-src *",
			"https://cdn.example.com/path",
		]) {
			process.env[BRAND_ORIGIN_VARIABLE] = value;
			expect(imageOrigins()).toEqual([]);
		}
	});
});
