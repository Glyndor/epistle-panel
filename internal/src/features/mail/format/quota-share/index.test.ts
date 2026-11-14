import { describe, expect, it } from "bun:test";

import { quotaShare } from ".";

const GB = 1_000_000_000;

describe("quotaShare", () => {
	it("has no share to show without a limit", () => {
		expect(quotaShare({ used: 5 * GB, limit: null })).toEqual({
			level: "unlimited",
			share: null,
		});
		expect(quotaShare({ used: 5 * GB, limit: 0 })).toEqual({
			level: "unlimited",
			share: null,
		});
	});

	it("is ok below nine tenths, near from there, and full at the limit", () => {
		expect(quotaShare({ used: 0, limit: 10 * GB })).toEqual({
			level: "ok",
			share: 0,
		});
		expect(quotaShare({ used: 8_999_999_999, limit: 10 * GB }).level).toBe(
			"ok",
		);
		expect(quotaShare({ used: 9 * GB, limit: 10 * GB })).toEqual({
			level: "near",
			share: 0.9,
		});
		expect(quotaShare({ used: 9_999_999_999, limit: 10 * GB }).level).toBe(
			"near",
		);
		expect(quotaShare({ used: 10 * GB, limit: 10 * GB })).toEqual({
			level: "full",
			share: 1,
		});
	});

	it("reads usage over the limit as full, never as more than all of it", () => {
		expect(quotaShare({ used: 25 * GB, limit: 10 * GB })).toEqual({
			level: "full",
			share: 1,
		});
	});
});
