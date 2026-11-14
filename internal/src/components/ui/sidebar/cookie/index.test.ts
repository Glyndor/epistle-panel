import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SIDEBAR_COOKIE, sidebarCookie, sidebarStartsOpen } from ".";

describe("the sidebar's cookie", () => {
	it("is a plain value a server layout can read, not a client module's export", () => {
		// On the server an export of a `"use client"` module is a reference
		// to the module. A layout that asked the request for a cookie named
		// by one never found it, and the sidebar was always served expanded.
		const source = readFileSync(join(import.meta.dir, "index.ts"), "utf8");

		expect(source).not.toMatch(/^\s*["']use client["']/m);
		expect(SIDEBAR_COOKIE).toBe("sidebar_state");
	});

	it("starts collapsed only for the one value the provider writes for it", () => {
		expect(sidebarStartsOpen("false")).toBe(false);
		for (const value of [undefined, "true", "", "False", "0", "garbage"]) {
			expect([value, sidebarStartsOpen(value)]).toEqual([value, true]);
		}
	});

	it("is written for the whole panel, so the choice made in the mail holds in the administration", () => {
		expect(sidebarCookie(false)).toBe(
			"sidebar_state=false; path=/; max-age=31536000; SameSite=Lax",
		);
		expect(sidebarCookie(true)).toBe(
			"sidebar_state=true; path=/; max-age=31536000; SameSite=Lax",
		);
		// What is written is what is read back.
		expect(sidebarStartsOpen("false")).toBe(false);
	});
});
