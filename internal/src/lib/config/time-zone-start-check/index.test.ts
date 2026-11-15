import { afterEach, expect, it, spyOn } from "bun:test";
import { TIME_ZONE_VARIABLE as KEY } from "../time-zone";
import { checkTimeZoneAtStart } from ".";

const saved = process.env[KEY];
afterEach(() => {
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("starts for unset, blank and every supported mode including whitespace", () => {
	delete process.env[KEY];
	expect(() =>
		checkTimeZoneAtStart((message) => {
			throw new Error(message);
		}),
	).not.toThrow();
	for (const value of [
		"",
		" ",
		"UTC",
		"America/Bogota",
		"Pacific/Kiritimati",
		" UTC ",
	]) {
		process.env[KEY] = value;
		expect(() =>
			checkTimeZoneAtStart((message) => {
				throw new Error(message);
			}),
		).not.toThrow();
	}
});
it("stops privately for invalid modes and case changes", () => {
	for (const value of ["utc", "invalid", "<private-marker>"]) {
		process.env[KEY] = value;
		const messages: string[] = [];
		expect(() =>
			checkTimeZoneAtStart((message) => {
				messages.push(message);
				throw new Error("stopped");
			}),
		).toThrow("stopped");
		expect(messages).toEqual([
			`${KEY} is set to a time zone the panel does not know`,
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
		expect(() => checkTimeZoneAtStart()).toThrow("exit");
		expect(exit).toHaveBeenCalledWith(1);
		expect(error).toHaveBeenCalledWith(
			`${KEY} is set to a time zone the panel does not know`,
		);
	} finally {
		error.mockRestore();
		exit.mockRestore();
	}
});
