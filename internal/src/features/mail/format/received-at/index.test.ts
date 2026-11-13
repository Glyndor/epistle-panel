import { describe, expect, it } from "bun:test";

import { formatReceivedAt } from ".";

const format = {
	dateTime: (value: Date, options: object) =>
		`${value.toISOString()}|${JSON.stringify(options)}`,
};

describe("formatReceivedAt", () => {
	it("formats a date in UTC with a date and a time", () => {
		expect(formatReceivedAt(format, "2026-11-12T10:00:00Z")).toBe(
			'2026-11-12T10:00:00.000Z|{"dateStyle":"medium","timeStyle":"short","timeZone":"UTC"}',
		);
	});

	it("can leave the time out", () => {
		expect(formatReceivedAt(format, "2026-11-12T10:00:00Z", false)).toBe(
			'2026-11-12T10:00:00.000Z|{"dateStyle":"medium","timeZone":"UTC"}',
		);
	});

	it("gives nothing for a value that is not a date", () => {
		expect(formatReceivedAt(format, "yesterday")).toBe("");
		expect(formatReceivedAt(format, "")).toBe("");
	});
});
