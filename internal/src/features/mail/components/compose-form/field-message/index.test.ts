import { describe, expect, it } from "bun:test";

import { COMPOSE_SIZE_MESSAGES } from "@/features/mail/schemas/compose-form";
import { fieldMessage } from ".";

const translate = (key: string) => `translated(${key})`;

describe("fieldMessage", () => {
	it("translates every message the schema gives", () => {
		for (const key of COMPOSE_SIZE_MESSAGES) {
			expect(fieldMessage(key, translate)).toBe(`translated(${key})`);
		}
	});

	it("leaves a sentence as it is", () => {
		expect(fieldMessage("These are not addresses: x@", translate)).toBe(
			"These are not addresses: x@",
		);
	});
});
