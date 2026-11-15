import { afterEach, expect, it, spyOn } from "bun:test";
import { isKnownPanelVariable } from "@/lib/config/panel-variables";
import { register } from "./instrumentation";

const saved = { ...process.env };
afterEach(() => {
	for (const key of Object.keys(process.env))
		if (!(key in saved)) delete process.env[key];
	Object.assign(process.env, saved);
});
it("recognizes both origin variables as plain variables, with no secret file form", () => {
	for (const name of [
		"EPISTLE_PANEL_STATIC_ORIGIN",
		"EPISTLE_PANEL_BRAND_ORIGIN",
	]) {
		expect(isKnownPanelVariable(name)).toBe(true);
		expect(isKnownPanelVariable(`${name}_FILE`)).toBe(false);
	}
});
it("runs the origins start check on Node and keeps hostile values private", async () => {
	process.env["NEXT_RUNTIME"] = "nodejs";
	process.env["EPISTLE_PANEL_BRAND_ORIGIN"] = "http://<private-marker>";
	const error = spyOn(console, "error").mockImplementation(() => {});
	const exit = spyOn(process, "exit").mockImplementation((() => {
		throw new Error("stopped");
	}) as never);
	try {
		await expect(register()).rejects.toThrow("stopped");
		expect(exit).toHaveBeenCalledWith(1);
		expect(error.mock.calls).toEqual([
			[
				"EPISTLE_PANEL_BRAND_ORIGIN is set to a value that is not one exact https origin",
			],
		]);
	} finally {
		error.mockRestore();
		exit.mockRestore();
	}
});
it("stops a build that serves its own files when the static origin is set", async () => {
	process.env["NEXT_RUNTIME"] = "nodejs";
	delete process.env["PANEL_BUILT_STATIC_ORIGIN"];
	process.env["EPISTLE_PANEL_STATIC_ORIGIN"] = "https://cdn.example.com";
	const error = spyOn(console, "error").mockImplementation(() => {});
	const exit = spyOn(process, "exit").mockImplementation((() => {
		throw new Error("stopped");
	}) as never);
	try {
		await expect(register()).rejects.toThrow("stopped");
		expect(exit).toHaveBeenCalledWith(1);
		expect(String(error.mock.calls[0]?.[0])).toContain(
			"EPISTLE_PANEL_STATIC_ORIGIN",
		);
	} finally {
		error.mockRestore();
		exit.mockRestore();
	}
});
it("leaves the origins check out of the edge runtime", async () => {
	process.env["NEXT_RUNTIME"] = "edge";
	process.env["EPISTLE_PANEL_BRAND_ORIGIN"] = "http://nope";
	const exit = spyOn(process, "exit").mockImplementation((() => {
		throw new Error("unexpected startup exit");
	}) as never);
	try {
		await expect(register()).resolves.toBeUndefined();
		expect(exit).not.toHaveBeenCalled();
	} finally {
		exit.mockRestore();
	}
});
