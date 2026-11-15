import { afterEach, describe, expect, it, spyOn } from "bun:test";

import {
	SESSION_ADMIN_MAX_AGE_VARIABLE,
	SESSION_IDLE_TIMEOUT_VARIABLE,
	SESSION_USER_MAX_AGE_VARIABLE,
} from "../session-policy";

import { checkSessionPolicyAtStart } from ".";

const variables = [
	SESSION_USER_MAX_AGE_VARIABLE,
	SESSION_ADMIN_MAX_AGE_VARIABLE,
	SESSION_IDLE_TIMEOUT_VARIABLE,
];

afterEach(() => {
	for (const name of variables) {
		delete process.env[name];
	}
});

/** What the start would say before it stops; empty when it goes on. */
function whatTheStartSays(): string[] {
	const said: string[] = [];
	try {
		checkSessionPolicyAtStart((message) => {
			said.push(message);
			throw new Error("the start stopped");
		});
	} catch {
		// The check stops the start by throwing, the way it exits the process.
	}
	return said;
}

describe("checkSessionPolicyAtStart", () => {
	it("lets the start go on when every value can be used", () => {
		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "60";
		process.env[SESSION_IDLE_TIMEOUT_VARIABLE] = "5";

		expect(whatTheStartSays()).toEqual([]);
	});

	it("stops the start with a message that names the variable and not the value", () => {
		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "999999";

		const said = whatTheStartSays();

		expect(said).toHaveLength(1);
		expect(said[0]).toContain(SESSION_USER_MAX_AGE_VARIABLE);
		expect(said[0]).not.toContain("999999");
	});

	it("stops the start for an idle timeout that does not parse", () => {
		process.env[SESSION_IDLE_TIMEOUT_VARIABLE] = "soon";

		const said = whatTheStartSays();

		expect(said).toHaveLength(1);
		expect(said[0]).toContain(SESSION_IDLE_TIMEOUT_VARIABLE);
	});

	it("by default logs the message and exits with status 1", () => {
		process.env[SESSION_USER_MAX_AGE_VARIABLE] = "999999";
		const error = spyOn(console, "error").mockImplementation(() => {});
		const exit = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);
		try {
			expect(() => checkSessionPolicyAtStart()).toThrow("exit");

			expect(exit).toHaveBeenCalledWith(1);
			expect(String(error.mock.calls[0]?.[0])).toContain(
				SESSION_USER_MAX_AGE_VARIABLE,
			);
			expect(String(error.mock.calls[0]?.[0])).not.toContain("999999");
		} finally {
			error.mockRestore();
			exit.mockRestore();
		}
	});
	it("refuses every variable's invalid boundaries without logging its value", () => {
		for (const variable of variables) {
			for (const value of [
				"0",
				"-1",
				"43201",
				"9".repeat(400),
				"1.5",
				"1e3",
				"secret-setting",
				"NaN",
				"Infinity",
			]) {
				process.env[variable] = value;
				const said = whatTheStartSays();
				expect(said).toHaveLength(1);
				expect(said[0]).toContain(variable);
				// Tiny numeric values may occur in the documented range, so use a
				// recognizable sentinel to assert that the supplied text is not echoed.
				if (value.length > 5) expect(said[0]).not.toContain(value);
			}
			delete process.env[variable];
		}
	});

	it("accepts empty, whitespace and both exact bounds for every variable", () => {
		for (const variable of variables) {
			for (const value of ["", "   ", "1", "43200"]) {
				process.env[variable] = value;
				expect(whatTheStartSays()).toEqual([]);
			}
			delete process.env[variable];
		}
	});
});
