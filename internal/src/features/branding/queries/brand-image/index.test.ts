import { afterAll, afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	BRAND_FAVICON_VARIABLE,
	BRAND_LOGO_VARIABLE,
} from "@/features/branding/queries/brand";

import { MAX_BRAND_IMAGE_BYTES, readBrandImage } from ".";

const dir = mkdtempSync(join(tmpdir(), "brand-image-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
afterEach(() => {
	delete process.env[BRAND_LOGO_VARIABLE];
	delete process.env[BRAND_FAVICON_VARIABLE];
});

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"></svg>';

function use(variable: string, content: string | Buffer): void {
	const path = join(dir, `i-${Math.random()}`);
	writeFileSync(path, content);
	process.env[variable] = path;
}

describe("readBrandImage", () => {
	it("is undefined when the image is not configured", async () => {
		expect(await readBrandImage("logo")).toBeUndefined();
		expect(await readBrandImage("favicon")).toBeUndefined();
	});

	it("reads each image from its own variable and names its type from the bytes", async () => {
		use(BRAND_LOGO_VARIABLE, SVG);
		use(BRAND_FAVICON_VARIABLE, Buffer.from([0, 0, 1, 0, 1, 0]));

		expect((await readBrandImage("logo"))?.type).toBe("image/svg+xml");
		expect((await readBrandImage("favicon"))?.type).toBe("image/x-icon");
	});

	it("refuses a file that is not a supported image, whatever its name says", async () => {
		use(BRAND_LOGO_VARIABLE, "<html></html>");

		await expect(readBrandImage("logo")).rejects.toThrow(
			BRAND_LOGO_VARIABLE,
		);
	});

	it("refuses an image over the cap", async () => {
		use(
			BRAND_LOGO_VARIABLE,
			`<svg>${"a".repeat(MAX_BRAND_IMAGE_BYTES)}</svg>`,
		);

		await expect(readBrandImage("logo")).rejects.toThrow("too large");
	});
});
