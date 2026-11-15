import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { BRAND_ORIGIN_VARIABLE } from "../brand-origin";
import { STATIC_ORIGIN_VARIABLE } from "../static-origin";
import { checkOriginsAtStart } from ".";

const BUILT = "PANEL_BUILT_STATIC_ORIGIN";
const KEYS = [BRAND_ORIGIN_VARIABLE, STATIC_ORIGIN_VARIABLE, BUILT];
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
afterEach(() => {
	for (const key of KEYS) {
		const value = saved[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

/** What the check told `fail`, or `null` when it let the server start. */
function said(): string | null {
	let message: string | null = null;
	try {
		checkOriginsAtStart((text) => {
			message = text;
			throw new Error("stopped");
		});
	} catch {
		// `fail` never returns, so the check stops here.
	}
	return message;
}

describe("checkOriginsAtStart", () => {
	it("lets the server start with neither variable, and with blanks", () => {
		for (const key of KEYS) delete process.env[key];
		expect(said()).toBeNull();
		process.env[BRAND_ORIGIN_VARIABLE] = " ";
		process.env[STATIC_ORIGIN_VARIABLE] = "";
		expect(said()).toBeNull();
	});

	it("lets the server start with a brand origin, which is read at run time", () => {
		delete process.env[STATIC_ORIGIN_VARIABLE];
		delete process.env[BUILT];
		process.env[BRAND_ORIGIN_VARIABLE] = "https://brand.example.com";
		expect(said()).toBeNull();
	});

	it("lets the server start when the static origin is the one the build used", () => {
		process.env[BUILT] = "https://cdn.example.com";
		process.env[STATIC_ORIGIN_VARIABLE] = "https://CDN.example.com:443/";
		expect(said()).toBeNull();
	});

	it("stops for a brand origin that is not one exact https origin, naming the variable only", () => {
		for (const value of [
			"http://cdn.example.com",
			"https://*.example.com",
			"https://cdn.example.com/x",
			"https://u:p@cdn.example.com",
			"<private-marker>",
			"x".repeat(5000),
		]) {
			process.env[BRAND_ORIGIN_VARIABLE] = value;
			const message = said();
			expect(message).toBe(
				`${BRAND_ORIGIN_VARIABLE} is set to a value that is not one exact https origin`,
			);
			expect(message).not.toContain(value);
		}
	});

	it("stops for a static origin that is not one exact https origin, even on a build made for another", () => {
		process.env[BUILT] = "https://cdn.example.com";
		for (const value of [
			"http://cdn.example.com",
			"https://*",
			"x".repeat(5000),
		]) {
			process.env[STATIC_ORIGIN_VARIABLE] = value;
			const message = said();
			expect(message).toBe(
				`${STATIC_ORIGIN_VARIABLE} is set to a value that is not one exact https origin`,
			);
			expect(message).not.toContain(value);
		}
	});

	it("stops when the static origin is set on a build that serves its own files", () => {
		delete process.env[BUILT];
		process.env[STATIC_ORIGIN_VARIABLE] = "https://cdn.example.com";
		const message = said();
		expect(message).toContain(STATIC_ORIGIN_VARIABLE);
		expect(message).toContain("read when the image is built");
		expect(message).not.toContain("cdn.example.com");
	});

	it("stops when a build made for a static origin is started without it", () => {
		process.env[BUILT] = "https://cdn.example.com";
		delete process.env[STATIC_ORIGIN_VARIABLE];
		const message = said();
		expect(message).toContain(STATIC_ORIGIN_VARIABLE);
		expect(message).toContain("is not set");
		expect(message).not.toContain("cdn.example.com");
	});

	it("stops when the static origin names another origin than the build", () => {
		process.env[BUILT] = "https://cdn.example.com";
		process.env[STATIC_ORIGIN_VARIABLE] = "https://other.example.com";
		const message = said();
		expect(message).toBe(
			`${STATIC_ORIGIN_VARIABLE} is not the origin this build serves its static files from`,
		);
	});

	it("logs the message and exits 1 by default", () => {
		process.env[BRAND_ORIGIN_VARIABLE] = "http://private-marker.example";
		const error = spyOn(console, "error").mockImplementation(() => {});
		const exit = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);
		try {
			expect(() => checkOriginsAtStart()).toThrow("exit");
			expect(exit).toHaveBeenCalledWith(1);
			expect(error).toHaveBeenCalledWith(
				`${BRAND_ORIGIN_VARIABLE} is set to a value that is not one exact https origin`,
			);
		} finally {
			error.mockRestore();
			exit.mockRestore();
		}
	});
});
