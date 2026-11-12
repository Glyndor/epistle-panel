import { describe, expect, it } from "bun:test";

import { fromEpochSeconds, MOMENT_FORMAT } from ".";

describe("time format", () => {
	it("turns epoch seconds into the same instant as milliseconds", () => {
		expect(fromEpochSeconds(0).toISOString()).toBe(
			"1970-01-01T00:00:00.000Z",
		);
		expect(fromEpochSeconds(1_700_000_000).getTime()).toBe(
			1_700_000_000_000,
		);
	});

	it("is written in UTC, so the server and the browser print the same text", () => {
		const text = new Intl.DateTimeFormat("en", MOMENT_FORMAT).format(
			fromEpochSeconds(1_700_000_000),
		);
		expect(text).toContain("Nov 14, 2023");
		expect(text).toContain("UTC");
	});
});
