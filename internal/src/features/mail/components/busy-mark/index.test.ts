import { describe, expect, it } from "bun:test";

import { BUSY_MARK } from ".";

const classes = BUSY_MARK.split(" ");

describe("BUSY_MARK", () => {
	it("says busy with the cursor, a dimmed icon and a dot, all from aria-busy", () => {
		expect(classes).toContain("aria-busy:cursor-progress");
		expect(classes).toContain("aria-busy:hover:cursor-progress");
		expect(classes).toContain("aria-busy:text-muted-foreground");
		expect(classes).toContain("aria-busy:after:rounded-full");
		// Nothing shows at rest: every sign waits for the attribute.
		expect(
			classes.filter((name) => !name.startsWith("aria-busy:")),
		).toEqual(["relative"]);
	});

	it("lays the dot over the button's corner, 6 px, so the button neither moves nor grows", () => {
		expect(classes).toContain("relative");
		expect(classes).toContain("aria-busy:after:absolute");
		expect(classes).toContain("aria-busy:after:size-1.5");
		expect(classes).toContain("aria-busy:after:top-0");
		expect(classes).toContain("aria-busy:after:end-0");
		expect(BUSY_MARK).not.toMatch(
			/(^|[\s:])(left|right)-|\bm[tblrxyse]?-|\bp[tblrxyse]?-/,
		);
	});
});
