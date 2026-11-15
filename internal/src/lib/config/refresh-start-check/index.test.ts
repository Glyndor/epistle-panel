import { afterEach, expect, it, spyOn } from "bun:test";
import { REFRESH_VARIABLE as KEY } from "../refresh";
import { checkRefreshAtStart } from ".";

const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
const stop = (message: string): never => {
	throw new Error(message);
};
it("starts for unset, blank and every pace of the list including whitespace", () => {
	delete process.env[KEY];
	expect(() => checkRefreshAtStart(stop)).not.toThrow();
	for (const value of ["", " ", "normal", "slow", "fast", " slow "]) {
		process.env[KEY] = value;
		expect(() => checkRefreshAtStart(stop)).not.toThrow();
	}
});
it("stops privately for a pace off the list, and for off in particular", () => {
	for (const value of ["off", "FAST", "<private-marker>"]) {
		process.env[KEY] = value;
		const messages: string[] = [];
		expect(() =>
			checkRefreshAtStart((message) => {
				messages.push(message);
				throw new Error("stopped");
			}),
		).toThrow("stopped");
		expect(messages).toEqual([
			`${KEY} is set to a pace the panel does not support`,
		]);
		expect(messages[0]).not.toContain(value);
	}
});
it("logs and exits 1 by default", () => {
	process.env[KEY] = "private-marker";
	const error = spyOn(console, "error").mockImplementation(() => {});
	const exit = spyOn(process, "exit").mockImplementation((() => {
		throw new Error("exit");
	}) as never);
	try {
		expect(() => checkRefreshAtStart()).toThrow("exit");
		expect(exit).toHaveBeenCalledWith(1);
		expect(error).toHaveBeenCalledWith(
			`${KEY} is set to a pace the panel does not support`,
		);
	} finally {
		error.mockRestore();
		exit.mockRestore();
	}
});
