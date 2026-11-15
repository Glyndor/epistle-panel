import { afterEach, beforeEach, expect, it } from "bun:test";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const KEY = "EPISTLE_PANEL_REMOTE_IMAGES";
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
	data.set("timeZone", "UTC");
	data.set("pageSize", "50");
	data.set("refresh", "normal");
	for (const mode of modes) data.append("remoteImages", mode);
	return data;
}
const save = (...modes: (string | File)[]) =>
	savePreferences({ outcome: "idle" }, form(...modes));
it("saves every valid remote image choice", async () => {
	await cookies.signIn();
	for (const mode of ["ask", "always", "never"] as const) {
		cookies.writes.length = 0;
		expect(await save(mode)).toEqual({
			outcome: "saved",
			values: {
				language: "en",
				theme: "system",
				density: "comfortable",
				remoteImages: mode,
				timeZone: "UTC",
				pageSize: "50",
				refresh: "normal",
			},
		});
		expect(cookies.writes.map((w) => [w.name, w.value])).toEqual([
			["locale", "en"],
			["theme", "system"],
			["list-density", "comfortable"],
			["remote-images", mode],
			["time-zone", "UTC"],
			["page-size", "50"],
			["refresh", "normal"],
		]);
	}
});
it("refuses invalid, missing, empty, duplicate and file choices before any write", async () => {
	await cookies.signIn();
	for (const [modes, error] of [
		[[], "required"],
		[[""], "required"],
		[["ASK"], "notInList"],
		[[" always "], "notInList"],
		[["<private-marker>"], "notInList"],
		[["never", "always"], "notInList"],
		[["ask", "ask"], "notInList"],
		[[new File(["ask"], "mode")], "notInList"],
	] as const) {
		expect(await save(...modes)).toEqual({
			outcome: "refused",
			fields: { remoteImages: error },
		});
		expect(cookies.writes).toEqual([]);
	}
});
it("refuses any posted mode when the operator fixes it, including the same mode", async () => {
	await cookies.signIn();
	for (const operator of ["ask", "always", "never"] as const) {
		process.env[KEY] = operator;
		for (const chosen of ["ask", "always", "never", "hostile"]) {
			expect(await save(chosen)).toEqual({
				outcome: "refused",
				fields: { remoteImages: "notInList" },
			});
			expect(cookies.writes).toEqual([]);
		}
	}
});
it("saves other fields when fixed without overwriting the remote image cookie", async () => {
	await cookies.signIn();
	for (const operator of ["ask", "always", "never"] as const) {
		cookies.writes.length = 0;
		process.env[KEY] = operator;
		cookies.jar.set("remote-images", "always");
		expect(await save()).toEqual({
			outcome: "saved",
			values: {
				language: "en",
				theme: "system",
				density: "comfortable",
				remoteImages: operator,
				timeZone: "UTC",
				pageSize: "50",
				refresh: "normal",
			},
		});
		expect(cookies.writes.map((w) => w.name)).toEqual([
			"locale",
			"theme",
			"list-density",
			"time-zone",
			"page-size",
			"refresh",
		]);
		expect(cookies.jar.get("remote-images")).toBe("always");
	}
});
it("still validates other fields with an operator policy", async () => {
	await cookies.signIn();
	process.env[KEY] = "never";
	const data = form();
	data.set("theme", "hostile");
	expect(await savePreferences({ outcome: "idle" }, data)).toEqual({
		outcome: "refused",
		fields: { theme: "notInList" },
	});
	expect(cookies.writes).toEqual([]);
});
it("writes nothing without a session for any mode or fixed policy", async () => {
	for (const operator of [undefined, "never"]) {
		if (operator) process.env[KEY] = operator;
		else delete process.env[KEY];
		for (const mode of ["ask", "always", "never"] as const) {
			expect(await save(mode)).toEqual({ outcome: "failed" });
			expect(cookies.writes).toEqual([]);
		}
	}
});
