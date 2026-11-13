import { describe, expect, it } from "bun:test";

import { displayNameSchema, totpEnrolledSchema, updatedSchema } from ".";

describe("account change schemas", () => {
	it("reads the three answers", () => {
		expect(updatedSchema.parse({ updated: "alice" }).updated).toBe("alice");
		expect(
			displayNameSchema.parse({ display_name: null }).display_name,
		).toBeNull();
		expect(
			displayNameSchema.parse({ display_name: "Al" }).display_name,
		).toBe("Al");
		expect(
			totpEnrolledSchema.parse({
				secret: "ABC",
				otpauth_uri: "otpauth://x",
			}).secret,
		).toBe("ABC");
	});

	it("refuses a missing secret or a display name of the wrong type", () => {
		expect(totpEnrolledSchema.safeParse({ otpauth_uri: "x" }).success).toBe(
			false,
		);
		expect(displayNameSchema.safeParse({ display_name: 5 }).success).toBe(
			false,
		);
		expect(displayNameSchema.safeParse({}).success).toBe(false);
	});
});
