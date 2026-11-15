import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { COPYRIGHT_NOTICE_VARIABLE } from "../copyright-notice";

import { checkCopyrightNoticeAtStart } from ".";

afterEach(() => {
	delete process.env[COPYRIGHT_NOTICE_VARIABLE];
});

/** What the start would say before it stops; empty when it goes on. */
function whatTheStartSays(): string[] {
	const said: string[] = [];
	try {
		checkCopyrightNoticeAtStart((message) => {
			said.push(message);
			throw new Error("the start stopped");
		});
	} catch {
		// The check stops the start by throwing, the way it exits the process.
	}
	return said;
}

describe("checkCopyrightNoticeAtStart", () => {
	it("lets the start go on when the line can be shown", () => {
		for (const value of ["", "  ", "© 2026 Acme", "none"]) {
			process.env[COPYRIGHT_NOTICE_VARIABLE] = value;

			expect([value, whatTheStartSays()]).toEqual([value, []]);
		}
	});

	it("lets the start go on when no line is set", () => {
		expect(whatTheStartSays()).toEqual([]);
	});

	it("stops the start with a message that names the variable and not the value", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = "x".repeat(1_000);

		const said = whatTheStartSays();

		expect(said).toHaveLength(1);
		expect(said[0]).toContain(COPYRIGHT_NOTICE_VARIABLE);
		expect(said[0]).not.toContain("x".repeat(1_000));
	});

	it("by default logs the message and exits with status 1", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = "x".repeat(1_000);
		const error = spyOn(console, "error").mockImplementation(() => {});
		const exit = spyOn(process, "exit").mockImplementation((() => {
			throw new Error("exit");
		}) as never);
		try {
			expect(() => checkCopyrightNoticeAtStart()).toThrow("exit");

			expect(exit).toHaveBeenCalledWith(1);
			expect(String(error.mock.calls[0]?.[0])).toContain(
				COPYRIGHT_NOTICE_VARIABLE,
			);
			expect(String(error.mock.calls[0]?.[0])).not.toContain(
				"x".repeat(1_000),
			);
		} finally {
			error.mockRestore();
			exit.mockRestore();
		}
	});
});
