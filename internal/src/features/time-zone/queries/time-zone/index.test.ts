import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const KEY = "EPISTLE_PANEL_TIME_ZONE";
const saved = process.env[KEY];
const { readEffectiveTimeZone, readTimeZonePreference } = await import(".");
beforeEach(() => {
	cookies.reset();
	delete process.env[KEY];
});
afterEach(() => {
	cookies.reset();
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
it("reads only exact cookie names and defaults privately to UTC", async () => {
	expect(await readTimeZonePreference()).toBe("UTC");
	cookies.jar.set("time-zone", "America/Bogota");
	expect(await readTimeZonePreference()).toBe("America/Bogota");
	for (const value of [
		"Mars/Base",
		"utc",
		" UTC",
		"UTC ",
		"../",
		"x".repeat(5000),
		"Etc/GMT+14",
	]) {
		cookies.jar.set("time-zone", value);
		expect(await readTimeZonePreference()).toBe("UTC");
	}
	expect(cookies.writes).toEqual([]);
});
it("uses operator then cookie then UTC and never silently ignores bad operator config", async () => {
	expect(await readEffectiveTimeZone()).toBe("UTC");
	cookies.jar.set("time-zone", "Pacific/Kiritimati");
	expect(await readEffectiveTimeZone()).toBe("Pacific/Kiritimati");
	for (const zone of ["UTC", "America/Bogota"]) {
		process.env[KEY] = zone;
		expect(await readEffectiveTimeZone()).toBe(zone);
	}
	process.env[KEY] = "Mars/Base";
	await expect(readEffectiveTimeZone()).rejects.toThrow(KEY);
});
