import { expect, it } from "bun:test";
import {
	DEFAULT_TIME_ZONE,
	isTimeZone,
	parseTimeZone,
	resolveTimeZone,
	TIME_ZONE_GROUPS,
	TIME_ZONES,
} from ".";

it("holds exactly UTC plus the process list, frozen and grouped without losing names", () => {
	expect(DEFAULT_TIME_ZONE).toBe("UTC");
	expect(TIME_ZONES).toEqual(["UTC", ...Intl.supportedValuesOf("timeZone")]);
	expect(Object.isFrozen(TIME_ZONES)).toBe(true);
	expect(TIME_ZONE_GROUPS.flatMap((g) => g.zones)).toEqual([
		"UTC",
		...TIME_ZONES.filter((zone) => zone !== "UTC"),
	]);
	expect(TIME_ZONE_GROUPS[0]).toEqual({ region: "", zones: ["UTC"] });
	for (const group of TIME_ZONE_GROUPS.slice(1)) {
		expect(group.zones).toEqual([...group.zones].sort());
		for (const zone of group.zones)
			expect(zone.split("/")[0]).toBe(group.region);
	}
	expect(TIME_ZONE_GROUPS.slice(1).map((g) => g.region)).toEqual(
		TIME_ZONE_GROUPS.slice(1)
			.map((g) => g.region)
			.sort(),
	);
});
it("believes every listed name exactly and rejects aliases, hostile text and nonstrings", () => {
	for (const zone of TIME_ZONES) {
		expect(isTimeZone(zone)).toBe(true);
		expect(parseTimeZone(zone)).toBe(zone);
		expect(resolveTimeZone(zone)).toBe(zone);
	}
	for (const value of [
		undefined,
		null,
		0,
		{},
		["UTC"],
		"Mars/Base",
		"utc",
		"america/bogota",
		" UTC",
		"UTC ",
		"../",
		"x".repeat(5000),
		"Etc/GMT+14",
	]) {
		expect(isTimeZone(value)).toBe(false);
		expect(parseTimeZone(value)).toBe("UTC");
		if (typeof value === "string")
			expect(resolveTimeZone(value)).toBe("UTC");
	}
});

it("keeps only UTC when Intl cannot enumerate zones in an older runtime", () => {
	const child = Bun.spawnSync(
		[
			process.execPath,
			"--eval",
			`Object.defineProperty(Intl,"supportedValuesOf",{value:undefined,writable:true,configurable:true}); const {TIME_ZONES,TIME_ZONE_GROUPS}=await import("./index.ts"); console.log(JSON.stringify([TIME_ZONES,TIME_ZONE_GROUPS]));`,
		],
		{ cwd: import.meta.dir },
	);
	expect(child.exitCode).toBe(0);
	expect(child.stdout.toString().trim()).toBe(
		JSON.stringify([["UTC"], [{ region: "", zones: ["UTC"] }]]),
	);
});
