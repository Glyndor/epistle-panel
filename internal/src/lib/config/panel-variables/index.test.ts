import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import {
	isKnownPanelVariable,
	PANEL_SECRET_VARIABLES,
	PANEL_VARIABLES,
	unknownPanelVariables,
	warnUnknownPanelVariables,
} from ".";

describe("panel variables", () => {
	it("knows each listed name and the _FILE form of a secret only", () => {
		for (const name of PANEL_VARIABLES) {
			expect(isKnownPanelVariable(name)).toBe(true);
		}
		for (const name of PANEL_SECRET_VARIABLES) {
			expect(PANEL_VARIABLES).toContain(name);
			expect(isKnownPanelVariable(`${name}_FILE`)).toBe(true);
		}
		expect(isKnownPanelVariable("EPISTLE_PANEL_LOGIN_MIN_MS_FILE")).toBe(
			false,
		);
		expect(isKnownPanelVariable("EPISTLE_PANEL_LOGIN_MIN_MSS")).toBe(false);
	});

	it("returns the misspelt names sorted and ignores other prefixes", () => {
		const env = {
			EPISTLE_PANEL_ZZ: "1",
			EPISTLE_PANEL_LOGIN_MIN_MSS: "5",
			EPISTLE_PANEL_LOGIN_MIN_MS: "5",
			EPISTLE_PANEL_SESSION_SECRET_FILE: "/run/x",
			EPISTLE_API_URL: "http://x",
			PATH: "/bin",
		};
		expect(unknownPanelVariables(env)).toEqual([
			"EPISTLE_PANEL_LOGIN_MIN_MSS",
			"EPISTLE_PANEL_ZZ",
		]);
	});

	it("warns with the name and never with the value", () => {
		const lines: string[] = [];
		warnUnknownPanelVariables(
			{
				EPISTLE_PANEL_LOGIN_MIN_MSS: "hunter2",
				EPISTLE_PANEL_SESSION_SECRET: "hunter2",
			},
			(line) => lines.push(line),
		);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toContain("EPISTLE_PANEL_LOGIN_MIN_MSS");
		expect(lines[0]).not.toContain("hunter2");
	});

	it("does not warn when every name is known", () => {
		const lines: string[] = [];
		warnUnknownPanelVariables({ EPISTLE_PANEL_BRAND_NAME: "x" }, (l) =>
			lines.push(l),
		);
		expect(lines).toEqual([]);
	});

	it("lists every EPISTLE_PANEL_ name the source mentions", () => {
		const missing: string[] = [];
		const glob = new Bun.Glob("**/*.{ts,tsx}");
		for (const file of glob.scanSync({ cwd: "src" })) {
			if (/\.test\.tsx?$/.test(file) || file.includes("test-support")) {
				continue;
			}
			const text = readFileSync(`src/${file}`, "utf8");
			for (const [name] of text.matchAll(
				/EPISTLE_PANEL_[A-Z0-9_]*[A-Z0-9]/g,
			)) {
				if (!isKnownPanelVariable(name)) {
					missing.push(`${file}: ${name}`);
				}
			}
		}
		expect(missing).toEqual([]);
	});
});
