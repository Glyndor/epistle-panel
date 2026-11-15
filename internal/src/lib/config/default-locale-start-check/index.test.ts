import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { DEFAULT_LOCALE_VARIABLE } from "../default-locale";

import { checkDefaultLocaleAtStart } from ".";

afterEach(() => {
	delete process.env[DEFAULT_LOCALE_VARIABLE];
});

/** What the start would say before it stops; empty when it goes on. */
function whatTheStartSays(): string[] {
	const said: string[] = [];
	try {
		checkDefaultLocaleAtStart((message) => {
			said.push(message);
			throw new Error("the start stopped");
		});
	} catch {
		// The check stops the start by throwing, the way it exits the process.
	}
	return said;
}

describe("checkDefaultLocaleAtStart", () => {
	it("lets the start go on when the language is one the panel ships", () => {
		process.env[DEFAULT_LOCALE_VARIABLE] = "fr";

		expect(whatTheStartSays()).toEqual([]);
	});

	it("lets the start go on when no language is set", () => {
		expect(whatTheStartSays()).toEqual([]);
	});

	it("stops the start with a message that names the variable and not the value", () => {
		process.env[DEFAULT_LOCALE_VARIABLE] = "klingon";

		const said = whatTheStartSays();

		expect(said).toHaveLength(1);
		expect(said[0]).toContain(DEFAULT_LOCALE_VARIABLE);
		expect(said[0]).not.toContain("klingon");
	});

	it("by default logs the message and exits with status 1", () => {
		process.env[DEFAULT_LOCALE_VARIABLE] = "klingon";
		const error = spyOn(console, "error").mockImplementation(() => {});
		const exit = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);
		try {
			expect(() => checkDefaultLocaleAtStart()).toThrow("exit");

			expect(exit).toHaveBeenCalledWith(1);
			expect(String(error.mock.calls[0]?.[0])).toContain(
				DEFAULT_LOCALE_VARIABLE,
			);
			expect(String(error.mock.calls[0]?.[0])).not.toContain("klingon");
		} finally {
			error.mockRestore();
			exit.mockRestore();
		}
	});
	it("accepts empty values and all six locales, and refuses unsupported values privately", () => {
		for (const value of ["", "  ", "en", "es", "pt", "fr", "de", "it"]) {
			process.env[DEFAULT_LOCALE_VARIABLE] = value;
			expect(whatTheStartSays()).toEqual([]);
		}
		for (const value of [
			"private-language",
			"EN",
			"es-CO",
			"../en",
			"💥",
			"x".repeat(1_000_000),
		]) {
			process.env[DEFAULT_LOCALE_VARIABLE] = value;
			const said = whatTheStartSays();
			expect(said).toHaveLength(1);
			expect(said[0]).toContain(DEFAULT_LOCALE_VARIABLE);
			expect(said[0]).not.toContain(value);
		}
	});
});
