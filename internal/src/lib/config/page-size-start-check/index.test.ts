import { afterEach, expect, it, spyOn } from "bun:test";
import { PAGE_SIZE_VARIABLE as KEY } from "../page-size";
import { checkPageSizeAtStart } from ".";

const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
const stop = (message: string): never => {
	throw new Error(message);
};
it("starts for unset, blank and every size of the list including whitespace", () => {
	delete process.env[KEY];
	expect(() => checkPageSizeAtStart(stop)).not.toThrow();
	for (const value of ["", " ", "25", "50", "100", " 100 "]) {
		process.env[KEY] = value;
		expect(() => checkPageSizeAtStart(stop)).not.toThrow();
	}
});
it("stops privately for a size off the list", () => {
	for (const value of ["30", "invalid", "<private-marker>"]) {
		process.env[KEY] = value;
		const messages: string[] = [];
		expect(() =>
			checkPageSizeAtStart((message) => {
				messages.push(message);
				throw new Error("stopped");
			}),
		).toThrow("stopped");
		expect(messages).toEqual([
			`${KEY} is set to a page size the panel does not support`,
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
		expect(() => checkPageSizeAtStart()).toThrow("exit");
		expect(exit).toHaveBeenCalledWith(1);
		expect(error).toHaveBeenCalledWith(
			`${KEY} is set to a page size the panel does not support`,
		);
	} finally {
		error.mockRestore();
		exit.mockRestore();
	}
});
