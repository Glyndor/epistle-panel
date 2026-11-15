import { describe, expect, it } from "bun:test";

import { MAX_KEYWORDS_PER_MESSAGE } from "@/features/mail/labels/keyword-codec";
import { LABEL_BATCH } from ".";

describe("LABEL_BATCH", () => {
	it("is a bound that a read of whole keyword sets can carry, and holds a message's labels once over", () => {
		expect(LABEL_BATCH).toBeGreaterThanOrEqual(MAX_KEYWORDS_PER_MESSAGE);
		expect(LABEL_BATCH).toBeLessThanOrEqual(500);
	});
});
