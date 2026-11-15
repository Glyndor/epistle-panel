import { expect, it } from "bun:test";

import {
	currentNames,
	currentZoneName,
	isTimeZone,
	parseTimeZone,
	TIME_ZONE_GROUPS,
} from ".";

// Node 24 lists the old names (Asia/Calcutta); Bun lists the current ones. The
// logic is tested against the Node-style list, whatever runs the test.
it("adds the current name of a renamed zone that the runtime lists under the old one", () => {
	const nodeStyle = ["Asia/Calcutta", "Europe/Kiev", "Europe/Paris"];
	expect(currentNames(nodeStyle)).toEqual(
		expect.arrayContaining(["Asia/Kolkata", "Europe/Kyiv"]),
	);
	expect(currentNames(nodeStyle)).not.toContain("Europe/Paris");
});

it("adds nothing when the runtime already lists the current name", () => {
	expect(currentNames(["Asia/Kolkata", "Europe/Kyiv"])).not.toContain(
		"Asia/Kolkata",
	);
	expect(currentNames(["Asia/Kolkata", "Europe/Kyiv"])).not.toContain(
		"Europe/Kyiv",
	);
});

it("takes the current name in this runtime, and still refuses what is not a zone", () => {
	expect(isTimeZone("Asia/Kolkata")).toBe(true);
	for (const value of [
		"asia/kolkata",
		"Asia/Kolkata ",
		"GMT+5",
		"Mars/Base",
		"IST",
		"Asia/Calcuta",
	]) {
		expect(isTimeZone(value)).toBe(false);
	}
});

it("shows a zone once in the select", () => {
	const shown = TIME_ZONE_GROUPS.flatMap((group) => group.zones);
	expect(new Set(shown).size).toBe(shown.length);
});

it("reads an old name under the current one when this runtime prints it, and leaves every other zone alone", () => {
	expect(currentZoneName("Asia/Calcutta")).toBe("Asia/Kolkata");
	// Node lists the old name and Bun does not: where it is a zone, it reads as the current one.
	if (isTimeZone("Asia/Calcutta")) {
		expect(parseTimeZone("Asia/Calcutta")).toBe("Asia/Kolkata");
	}
	expect(parseTimeZone("Asia/Kolkata")).toBe("Asia/Kolkata");
	expect(parseTimeZone("Europe/Paris")).toBe("Europe/Paris");
	expect(parseTimeZone("Mars/Base")).toBe("UTC");
});
