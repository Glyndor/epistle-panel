import { expect, it } from "bun:test";
import {
	allowsRemoteImages,
	isRemoteImageMode,
	parseRemoteImageMode,
	REMOTE_IMAGE_MODES,
} from ".";

it("recognizes only the three literal modes and defaults untrusted input to ask", () => {
	expect([...REMOTE_IMAGE_MODES]).toEqual(["ask", "always", "never"]);
	for (const mode of ["ask", "always", "never"] as const) {
		expect(isRemoteImageMode(mode)).toBe(true);
		expect(parseRemoteImageMode(mode)).toBe(mode);
	}
	for (const value of [undefined, null, 1, {}, "ASK", " never ", "<img>"]) {
		expect(isRemoteImageMode(value)).toBe(false);
		expect(parseRemoteImageMode(value)).toBe("ask");
	}
});
it("allows always, denies never, and lets ask depend on the request", () => {
	for (const [mode, requested, allowed] of [
		["ask", false, false],
		["ask", true, true],
		["always", false, true],
		["always", true, true],
		["never", false, false],
		["never", true, false],
	] as const)
		expect(allowsRemoteImages(mode, requested)).toBe(allowed);
});
