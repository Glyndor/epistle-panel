import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const KEY = "EPISTLE_PANEL_TIME_ZONE";
const saved = process.env[KEY];
const { savePreferences } = await import(".");
beforeEach(() => {
	cookies.reset();
	delete process.env[KEY];
});
afterEach(() => {
	cookies.reset();
	if (saved === undefined) delete process.env[KEY];
	else process.env[KEY] = saved;
});
function form(...modes: (string | File)[]) {
	const data = new FormData();
	data.set("language", "en");
	data.set("theme", "system");
	data.set("density", "comfortable");
	data.set("remoteImages", "ask");
	for (const mode of modes) data.append("timeZone", mode);
	return data;
}
const save = (...modes: (string | File)[]) =>
	savePreferences({ outcome: "idle" }, form(...modes));
it("saves every valid time zone choice", async () => {
	await cookies.signIn();
	for (const mode of [
		"UTC",
		"America/Bogota",
		"Pacific/Kiritimati",
	] as const) {
		cookies.writes.length = 0;
		expect(await save(mode)).toEqual({
			outcome: "saved",
			values: {
				language: "en",
				theme: "system",
				density: "comfortable",
				remoteImages: "ask",
				timeZone: mode,
			},
		});
		expect(cookies.writes.map((w) => [w.name, w.value])).toEqual([
			["locale", "en"],
			["theme", "system"],
			["list-density", "comfortable"],
			["remote-images", "ask"],
			["time-zone", mode],
		]);
	}
});
it("refuses invalid, missing, empty, duplicate and file choices before any write", async () => {
	await cookies.signIn();
	for (const [modes, error] of [
		[[], "required"],
		[[""], "required"],
		[["utc"], "notInList"],
		[[" UTC "], "notInList"],
		[["<private-marker>"], "notInList"],
		[["Pacific/Kiritimati", "America/Bogota"], "notInList"],
		[["UTC", "UTC"], "notInList"],
		[[new File(["UTC"], "mode")], "notInList"],
	] as const) {
		expect(await save(...modes)).toEqual({
			outcome: "refused",
			fields: { timeZone: error },
		});
		expect(cookies.writes).toEqual([]);
	}
});
it("refuses any posted mode when the operator fixes it, including the same mode", async () => {
	await cookies.signIn();
	for (const operator of [
		"UTC",
		"America/Bogota",
		"Pacific/Kiritimati",
	] as const) {
		process.env[KEY] = operator;
		for (const chosen of [
			"UTC",
			"America/Bogota",
			"Pacific/Kiritimati",
			"hostile",
		]) {
			expect(await save(chosen)).toEqual({
				outcome: "refused",
				fields: { timeZone: "notInList" },
			});
			expect(cookies.writes).toEqual([]);
		}
	}
});
it("saves other fields when fixed without overwriting the time zone cookie", async () => {
	await cookies.signIn();
	for (const operator of [
		"UTC",
		"America/Bogota",
		"Pacific/Kiritimati",
	] as const) {
		cookies.writes.length = 0;
		process.env[KEY] = operator;
		cookies.jar.set("time-zone", "America/Bogota");
		expect(await save()).toEqual({
			outcome: "saved",
			values: {
				language: "en",
				theme: "system",
				density: "comfortable",
				remoteImages: "ask",
				timeZone: operator,
			},
		});
		expect(cookies.writes.map((w) => w.name)).toEqual([
			"locale",
			"theme",
			"list-density",
			"remote-images",
		]);
		expect(cookies.jar.get("time-zone")).toBe("America/Bogota");
	}
});
it("still validates other fields with an operator policy", async () => {
	await cookies.signIn();
	process.env[KEY] = "Pacific/Kiritimati";
	const data = form();
	data.set("theme", "hostile");
	expect(await savePreferences({ outcome: "idle" }, data)).toEqual({
		outcome: "refused",
		fields: { theme: "notInList" },
	});
	expect(cookies.writes).toEqual([]);
});
it("writes nothing without a session for any mode or fixed policy", async () => {
	for (const operator of [undefined, "Pacific/Kiritimati"]) {
		if (operator) process.env[KEY] = operator;
		else delete process.env[KEY];
		for (const mode of [
			"UTC",
			"America/Bogota",
			"Pacific/Kiritimati",
		] as const) {
			expect(await save(mode)).toEqual({ outcome: "failed" });
			expect(cookies.writes).toEqual([]);
		}
	}
});
