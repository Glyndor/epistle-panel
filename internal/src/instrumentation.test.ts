import { afterEach, describe, expect, it, spyOn } from "bun:test";

import { register } from "./instrumentation";

const saved = { ...process.env };

afterEach(() => {
	for (const key of Object.keys(process.env)) {
		if (!(key in saved)) {
			delete process.env[key];
		}
	}
	Object.assign(process.env, saved);
});

describe("register", () => {
	it("warns about an unknown panel variable on the Node runtime", async () => {
		process.env["NEXT_RUNTIME"] = "nodejs";
		process.env["EPISTLE_PANEL_TYPO"] = "hunter2";
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		await register();
		expect(warn).toHaveBeenCalledTimes(1);
		expect(String(warn.mock.calls[0]?.[0])).toContain("EPISTLE_PANEL_TYPO");
		expect(String(warn.mock.calls[0]?.[0])).not.toContain("hunter2");
		warn.mockRestore();
	});

	it("does nothing on another runtime", async () => {
		process.env["NEXT_RUNTIME"] = "edge";
		process.env["EPISTLE_PANEL_TYPO"] = "x";
		const warn = spyOn(console, "warn").mockImplementation(() => {});
		await register();
		expect(warn).not.toHaveBeenCalled();
		warn.mockRestore();
	});
});
