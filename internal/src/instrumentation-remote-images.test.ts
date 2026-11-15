import { afterEach, expect, it, spyOn } from "bun:test";
import { register } from "./instrumentation";

const env = { ...process.env };
afterEach(() => {
	process.env = { ...env };
});
it("recognizes the remote image operator variable at Node startup", async () => {
	process.env["NEXT_RUNTIME"] = "nodejs";
	process.env["EPISTLE_PANEL_REMOTE_IMAGES"] = "never";
	const warn = spyOn(console, "warn").mockImplementation(() => {});
	try {
		await register();
		expect(warn).not.toHaveBeenCalled();
	} finally {
		warn.mockRestore();
	}
});
it("stops Node startup for a hostile remote image policy without echoing it", async () => {
	process.env["NEXT_RUNTIME"] = "nodejs";
	process.env["EPISTLE_PANEL_REMOTE_IMAGES"] = "private-marker";
	const error = spyOn(console, "error").mockImplementation(() => {});
	const exit = spyOn(process, "exit").mockImplementation((() => {
		throw new Error("exit");
	}) as never);
	try {
		await expect(register()).rejects.toThrow("exit");
		expect(exit).toHaveBeenCalledWith(1);
		expect(error).toHaveBeenCalledWith(
			"EPISTLE_PANEL_REMOTE_IMAGES is set to a mode the panel does not support",
		);
	} finally {
		error.mockRestore();
		exit.mockRestore();
	}
});
it("leaves other runtimes alone even for an invalid remote image policy", async () => {
	process.env["NEXT_RUNTIME"] = "edge";
	process.env["EPISTLE_PANEL_REMOTE_IMAGES"] = "invalid";
	await expect(register()).resolves.toBeUndefined();
});
