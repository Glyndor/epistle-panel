import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { ConfigError } from "@/lib/config/config-error";

import {
	COPYRIGHT_NOTICE_NONE,
	COPYRIGHT_NOTICE_VARIABLE,
	copyrightNotice,
	DEFAULT_COPYRIGHT_NOTICE,
	MAX_COPYRIGHT_NOTICE_LENGTH,
	readCopyrightNotice,
} from ".";

let saved: string | undefined;

beforeEach(() => {
	saved = process.env[COPYRIGHT_NOTICE_VARIABLE];
});

afterEach(() => {
	if (saved === undefined) {
		delete process.env[COPYRIGHT_NOTICE_VARIABLE];
	} else {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = saved;
	}
});

describe("the copyright line", () => {
	it("shows the panel's own notice when the operator sets none", () => {
		delete process.env[COPYRIGHT_NOTICE_VARIABLE];

		expect(readCopyrightNotice()).toBe(DEFAULT_COPYRIGHT_NOTICE);
	});

	it("takes an empty or a blank value for the panel's own notice", () => {
		for (const value of ["", "   ", "\t\n "]) {
			process.env[COPYRIGHT_NOTICE_VARIABLE] = value;
			expect([value, readCopyrightNotice()]).toEqual([
				value,
				DEFAULT_COPYRIGHT_NOTICE,
			]);
		}
	});

	it("shows no line at all when the operator spells none", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = COPYRIGHT_NOTICE_NONE;

		expect(readCopyrightNotice()).toBeNull();
		expect(copyrightNotice()).toBeNull();
	});

	it("takes the line the operator chose, trimmed", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = "  © 2026 Acme  ";

		expect(readCopyrightNotice()).toBe("© 2026 Acme");
	});

	it("takes a line that looks like markup as the characters it is", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = "<b>Acme</b> & Co";

		expect(readCopyrightNotice()).toBe("<b>Acme</b> & Co");
	});

	it("takes a line of the longest length it allows", () => {
		const line = "x".repeat(MAX_COPYRIGHT_NOTICE_LENGTH);
		process.env[COPYRIGHT_NOTICE_VARIABLE] = line;

		expect(readCopyrightNotice()).toBe(line);
	});

	it("refuses a line one character over the longest it allows", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = "x".repeat(
			MAX_COPYRIGHT_NOTICE_LENGTH + 1,
		);

		expect(() => readCopyrightNotice()).toThrow(ConfigError);
	});

	it("refuses a line with a control character", () => {
		for (const value of ["a\nb", "a\tb", "a\u0000b", "a\u007fb"]) {
			process.env[COPYRIGHT_NOTICE_VARIABLE] = value;

			expect(() => readCopyrightNotice()).toThrow(ConfigError);
		}
	});

	it("names the variable and never the value when it refuses one", () => {
		const value = "x".repeat(MAX_COPYRIGHT_NOTICE_LENGTH + 1);
		process.env[COPYRIGHT_NOTICE_VARIABLE] = value;

		let message = "";
		try {
			readCopyrightNotice();
		} catch (error) {
			message = error instanceof Error ? error.message : "";
		}

		expect(message).toContain(COPYRIGHT_NOTICE_VARIABLE);
		expect(message).not.toContain(value);
	});

	it("falls back to the panel's own notice when the value cannot be read", () => {
		process.env[COPYRIGHT_NOTICE_VARIABLE] = "x".repeat(
			MAX_COPYRIGHT_NOTICE_LENGTH + 1,
		);

		expect(copyrightNotice()).toBe(DEFAULT_COPYRIGHT_NOTICE);
	});
});
