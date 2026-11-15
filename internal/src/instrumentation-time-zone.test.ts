import { afterEach, expect, it, spyOn } from "bun:test";
import { isKnownPanelVariable } from "@/lib/config/panel-variables";
import { register } from "./instrumentation";

const saved = { ...process.env };
afterEach(() => {
	for (const key of Object.keys(process.env))
		if (!(key in saved)) delete process.env[key];
	Object.assign(process.env, saved);
});
it("recognizes the plain time-zone variable but does not grant it a secret file form", () => {
	expect(isKnownPanelVariable("EPISTLE_PANEL_TIME_ZONE")).toBe(true);
	expect(isKnownPanelVariable("EPISTLE_PANEL_TIME_ZONE_FILE")).toBe(false);
});
it("runs the time-zone start check on Node and keeps hostile values private", async () => {
	process.env["NEXT_RUNTIME"] = "nodejs";
	process.env["EPISTLE_PANEL_TIME_ZONE"] = "<private-zone-marker>";
	const error = spyOn(console, "error").mockImplementation(() => {});
	const exit = spyOn(process, "exit").mockImplementation((() => {
		throw new Error("stopped");
	}) as never);
	try {
		await expect(register()).rejects.toThrow("stopped");
		expect(exit).toHaveBeenCalledWith(1);
		expect(error.mock.calls).toEqual([
			[
				"EPISTLE_PANEL_TIME_ZONE is set to a time zone the panel does not know",
			],
		]);
	} finally {
		error.mockRestore();
		exit.mockRestore();
	}
});
it("leaves time-zone startup checks out of the edge runtime", async () => {
	process.env["NEXT_RUNTIME"] = "edge";
	process.env["EPISTLE_PANEL_TIME_ZONE"] = "Mars/Base";
	const exit = spyOn(process, "exit").mockImplementation((() => {
		throw new Error("unexpected startup exit");
	}) as never);
	const error = spyOn(console, "error").mockImplementation(() => {});
	try {
		await expect(register()).resolves.toBeUndefined();
		expect(exit).not.toHaveBeenCalled();
	} finally {
		exit.mockRestore();
		error.mockRestore();
	}
});
