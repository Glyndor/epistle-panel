import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PANEL_VERSION } from ".";

describe("PANEL_VERSION", () => {
	it("is the version the panel's manifest states, which the release workflow holds to the tag", () => {
		const manifest = JSON.parse(
			readFileSync(
				join(import.meta.dir, "..", "..", "..", "package.json"),
				"utf8",
			),
		) as { version: string };

		expect(PANEL_VERSION).toBe(manifest.version);
		expect(PANEL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
	});
});
