import { afterEach, describe, expect, it } from "bun:test";
import { BRAND_ORIGIN_VARIABLE, readOperatorBrandOrigin } from ".";

const KEY = BRAND_ORIGIN_VARIABLE;
const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});

describe("readOperatorBrandOrigin", () => {
	it("is null when the variable is unset, blank or only whitespace", () => {
		delete process.env[KEY];
		expect(readOperatorBrandOrigin()).toBeNull();
		for (const value of ["", " ", " \t\n "]) {
			process.env[KEY] = value;
			expect(readOperatorBrandOrigin()).toBeNull();
		}
	});

	it("returns the exact origin of a valid value, normalised", () => {
		for (const [value, origin] of [
			["https://cdn.example.com", "https://cdn.example.com"],
			["  https://cdn.example.com/ ", "https://cdn.example.com"],
			["https://CDN.example.com:8443", "https://cdn.example.com:8443"],
			["https://cdn.example.com:443", "https://cdn.example.com"],
			["https://xn--bcher-kva.example", "https://xn--bcher-kva.example"],
		] as const) {
			process.env[KEY] = value;
			expect(readOperatorBrandOrigin()).toBe(origin);
		}
	});

	it("stops with a message that names the variable and never repeats the value", () => {
		for (const value of [
			"http://cdn.example.com",
			"https://*.example.com",
			"https://cdn.example.com/path",
			"https://user:pass@cdn.example.com",
			"https://cdn.example.com:0",
			"https://cdn.example.com;script-src *",
			"https://cdn.example.com img-src *",
			"https://bücher.example",
			"<script>private-marker</script>",
			"x".repeat(5000),
		]) {
			process.env[KEY] = value;
			expect(readOperatorBrandOrigin).toThrow(
				`${KEY} is set to a value that is not one exact https origin`,
			);
			try {
				readOperatorBrandOrigin();
			} catch (error) {
				expect(error).toBeInstanceOf(Error);
				expect((error as Error).name).toBe("ConfigError");
				expect(String(error)).toBe(
					`ConfigError: ${KEY} is set to a value that is not one exact https origin`,
				);
			}
		}
	});
});
