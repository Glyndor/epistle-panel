import { afterEach, describe, expect, it } from "bun:test";
import {
	builtStaticOrigin,
	readOperatorStaticOrigin,
	STATIC_ORIGIN_VARIABLE,
	staticOriginBuildConfig,
} from ".";

const KEY = STATIC_ORIGIN_VARIABLE;
const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});

describe("readOperatorStaticOrigin", () => {
	it("is null when the variable is unset, blank or only whitespace", () => {
		delete process.env[KEY];
		expect(readOperatorStaticOrigin()).toBeNull();
		for (const value of ["", " ", " \t\n "]) {
			process.env[KEY] = value;
			expect(readOperatorStaticOrigin()).toBeNull();
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
			expect(readOperatorStaticOrigin()).toBe(origin);
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
			expect(readOperatorStaticOrigin).toThrow(
				`${KEY} is set to a value that is not one exact https origin`,
			);
			try {
				readOperatorStaticOrigin();
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

describe("builtStaticOrigin", () => {
	const BUILT = "PANEL_BUILT_STATIC_ORIGIN";
	const savedBuilt = process.env[BUILT];
	afterEach(() => {
		if (savedBuilt === undefined) delete process.env[BUILT];
		else process.env[BUILT] = savedBuilt;
	});

	it("is null for a build with no static origin", () => {
		delete process.env[BUILT];
		expect(builtStaticOrigin()).toBeNull();
		process.env[BUILT] = "";
		expect(builtStaticOrigin()).toBeNull();
	});

	it("is the origin the build was made for", () => {
		process.env[BUILT] = "https://cdn.example.com";
		expect(builtStaticOrigin()).toBe("https://cdn.example.com");
	});
});

describe("staticOriginBuildConfig", () => {
	it("sets nothing without an origin, so the build is the one the panel always made", () => {
		expect(staticOriginBuildConfig(null)).toEqual({});
		expect("assetPrefix" in staticOriginBuildConfig(null)).toBe(false);
	});

	it("sets Next's asset prefix and the value the server reads back, and nothing else", () => {
		expect(staticOriginBuildConfig("https://cdn.example.com")).toEqual({
			assetPrefix: "https://cdn.example.com",
			env: { PANEL_BUILT_STATIC_ORIGIN: "https://cdn.example.com" },
		});
	});
});
