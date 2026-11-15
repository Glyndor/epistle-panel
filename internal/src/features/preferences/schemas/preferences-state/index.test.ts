import { describe, expect, it } from "bun:test";

import { INITIAL_PREFERENCES_STATE } from ".";

describe("INITIAL_PREFERENCES_STATE", () => {
	it("says nothing was tried yet, so the form shows no notice", () => {
		expect(INITIAL_PREFERENCES_STATE).toEqual({ outcome: "idle" });
	});
});
