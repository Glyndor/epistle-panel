import { afterEach, expect, it, spyOn } from "bun:test";
import { REMOTE_IMAGES_VARIABLE as KEY } from "../remote-images";
import { checkRemoteImagesAtStart } from ".";

const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("starts for unset, blank and every supported mode including whitespace", () => {
	delete process.env[KEY];
	expect(() =>
		checkRemoteImagesAtStart((message) => {
			throw new Error(message);
		}),
	).not.toThrow();
	for (const value of ["", " ", "ask", "always", "never", " never "]) {
		process.env[KEY] = value;
		expect(() =>
			checkRemoteImagesAtStart((message) => {
				throw new Error(message);
			}),
		).not.toThrow();
	}
});
it("stops privately for invalid modes and case changes", () => {
	for (const value of ["ASK", "invalid", "<private-marker>"]) {
		process.env[KEY] = value;
		const messages: string[] = [];
		expect(() =>
			checkRemoteImagesAtStart((message) => {
				messages.push(message);
				throw new Error("stopped");
			}),
		).toThrow("stopped");
		expect(messages).toEqual([
			`${KEY} is set to a mode the panel does not support`,
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
		expect(() => checkRemoteImagesAtStart()).toThrow("exit");
		expect(exit).toHaveBeenCalledWith(1);
		expect(error).toHaveBeenCalledWith(
			`${KEY} is set to a mode the panel does not support`,
		);
	} finally {
		error.mockRestore();
		exit.mockRestore();
	}
});
