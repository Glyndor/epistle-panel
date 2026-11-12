import { describe, expect, it } from "bun:test";

import { statusSchema } from ".";

describe("statusSchema", () => {
	it("parses the documented shape", () => {
		const parsed = statusSchema.parse({
			version: "0.1.0",
			domains: 1,
			accounts: 2,
			queue_size: 0,
		});
		expect(parsed.queue_size).toBe(0);
	});

	it("rejects negative counters", () => {
		expect(() =>
			statusSchema.parse({
				version: "0.1.0",
				domains: -1,
				accounts: 0,
				queue_size: 0,
			}),
		).toThrow();
	});
});
