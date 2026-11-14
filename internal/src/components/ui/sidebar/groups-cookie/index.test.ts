import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SIDEBAR_GROUPS, SIDEBAR_GROUPS_COOKIE, sidebarGroupsCookie } from ".";

describe("the cookie of the sidebar's groups", () => {
	it("is a plain module a server layout and the provider can both import", () => {
		// No `"use client"`: the layouts read the cookie by this name, and a
		// name exported from a client module is a reference on the server. No
		// schema library: the provider, which is a client module, imports it.
		const source = readFileSync(join(import.meta.dir, "index.ts"), "utf8");

		expect(source).not.toMatch(/^\s*["']use client["']/m);
		expect(source).not.toMatch(/from\s+["']zod["']/);
		expect(SIDEBAR_GROUPS_COOKIE).toBe("sidebar_groups");
	});

	it("knows the groups of both areas, and only those", () => {
		expect([...SIDEBAR_GROUPS]).toEqual(["manage", "folders"]);
	});

	it("is written for the whole panel, with the closed groups in one fixed order, each once", () => {
		expect(sidebarGroupsCookie(["folders"])).toBe(
			"sidebar_groups=folders; path=/; max-age=31536000; SameSite=Lax",
		);
		expect(sidebarGroupsCookie(["folders", "manage"])).toBe(
			"sidebar_groups=manage.folders; path=/; max-age=31536000; SameSite=Lax",
		);
		expect(sidebarGroupsCookie(["manage", "manage"])).toBe(
			"sidebar_groups=manage; path=/; max-age=31536000; SameSite=Lax",
		);
	});

	it("is taken away when no group is closed", () => {
		expect(sidebarGroupsCookie([])).toBe(
			"sidebar_groups=; path=/; max-age=0; SameSite=Lax",
		);
	});
});
