import { describe, expect, it } from "bun:test";

import { ActionError, type ActionResult, assertNever, unwrap } from ".";

describe("unwrap", () => {
	it("returns the data of a successful result", () => {
		const result: ActionResult<number> = { ok: true, data: 7 };

		expect(unwrap(result)).toBe(7);
	});

	it("throws an ActionError carrying the reason for each failure", () => {
		for (const reason of [
			"unauthenticated",
			"unavailable",
			"invalid",
		] as const) {
			const result: ActionResult<number> = { ok: false, reason };

			const error = (() => {
				try {
					return unwrap(result);
				} catch (e) {
					return e;
				}
			})();

			expect(error).toBeInstanceOf(ActionError);
			expect((error as ActionError).reason).toBe(reason);
			expect((error as ActionError).message).toBe(
				`action failed: ${reason}`,
			);
		}
	});
});

describe("assertNever", () => {
	it("throws for a value that should not exist", () => {
		expect(() => assertNever("x" as never)).toThrow("unhandled case: x");
	});
});
