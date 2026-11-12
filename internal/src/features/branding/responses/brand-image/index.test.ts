import {
	afterAll,
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	spyOn,
} from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BRAND_LOGO_VARIABLE } from "@/features/branding/queries/brand";

import { brandImageResponse } from ".";

const dir = mkdtempSync(join(tmpdir(), "brand-response-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
	errors = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	delete process.env[BRAND_LOGO_VARIABLE];
	errors.mockRestore();
});

describe("brandImageResponse", () => {
	it("serves the image with its type, a short cache, and a sandboxing CSP", async () => {
		const path = join(dir, "logo.svg");
		writeFileSync(path, "<svg></svg>");
		process.env[BRAND_LOGO_VARIABLE] = path;

		const response = await brandImageResponse("logo");

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/svg+xml");
		expect(response.headers.get("cache-control")).toBe(
			"public, max-age=300",
		);
		expect(response.headers.get("content-security-policy")).toBe(
			"default-src 'none'; sandbox",
		);
		expect(await response.text()).toBe("<svg></svg>");
	});

	it("is a 404 when the image is not configured", async () => {
		expect((await brandImageResponse("logo")).status).toBe(404);
		expect((await brandImageResponse("favicon")).status).toBe(404);
	});

	it("is a 404, logged without the path, when the file is not an image", async () => {
		const path = join(dir, "bad.svg");
		writeFileSync(path, "<svg><script>x</script></svg>");
		process.env[BRAND_LOGO_VARIABLE] = path;

		const response = await brandImageResponse("logo");

		expect(response.status).toBe(404);
		const logged = String(errors.mock.calls[0]?.[0]);
		expect(logged).toContain(BRAND_LOGO_VARIABLE);
		expect(logged).not.toContain(dir);
	});
});
