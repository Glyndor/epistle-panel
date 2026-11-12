import { describe, expect, it } from "bun:test";

import { apiErrorSchema } from ".";

describe("apiErrorSchema", () => {
	it("parses the standard error shape", () => {
		const parsed = apiErrorSchema.parse({
			error: {
				code: "invalid_input",
				message: "Field must not be empty.",
			},
		});
		expect(parsed.error.code).toBe("invalid_input");
	});
});
