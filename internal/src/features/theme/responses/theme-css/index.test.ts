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

import { THEME_CSS_VARIABLE } from "@/features/theme/queries/theme-css";

import { THEME_MAX_AGE_SECONDS, themeCssResponse } from ".";

const dir = mkdtempSync(join(tmpdir(), "theme-response-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));
let errors: ReturnType<typeof spyOn>;
beforeEach(() => {
	errors = spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
	delete process.env[THEME_CSS_VARIABLE];
	errors.mockRestore();
});

describe("themeCssResponse", () => {
	it("serves the stylesheet as CSS with a short cache lifetime", async () => {
		const path = join(dir, "a.css");
		writeFileSync(path, ":root{--radius:1rem}");
		process.env[THEME_CSS_VARIABLE] = path;

		const response = await themeCssResponse();

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"text/css; charset=utf-8",
		);
		expect(response.headers.get("cache-control")).toBe(
			`public, max-age=${THEME_MAX_AGE_SECONDS}`,
		);
		expect(await response.text()).toBe(":root{--radius:1rem}");
	});

	it("is a 404 when none is configured", async () => {
		expect((await themeCssResponse()).status).toBe(404);
		expect(errors).not.toHaveBeenCalled();
	});

	it("is a 404 with a log line, and no path in either, when the file is unusable", async () => {
		process.env[THEME_CSS_VARIABLE] = join(dir, "missing.css");

		const response = await themeCssResponse();

		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
		const logged = String(errors.mock.calls[0]?.[0]);
		expect(logged).toContain(THEME_CSS_VARIABLE);
		expect(logged).not.toContain(dir);
	});

	it("shows an edit on the next request", async () => {
		const path = join(dir, "b.css");
		process.env[THEME_CSS_VARIABLE] = path;
		writeFileSync(path, "a{}");
		expect(await (await themeCssResponse()).text()).toBe("a{}");

		writeFileSync(path, "b{}");
		expect(await (await themeCssResponse()).text()).toBe("b{}");
	});
});
