import { describe, expect, it } from "bun:test";

import { PREFERENCE_FIELDS } from ".";

describe("PREFERENCE_FIELDS", () => {
	it("is the four fields of the form, in the order the page draws them", () => {
		expect([...PREFERENCE_FIELDS]).toEqual([
			"language",
			"theme",
			"density",
			"remoteImages",
		]);
	});
});
