import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { resetIntl } from "@/test/next-intl";

const cookies = mockRequestCookies();
const PAGE_SIZE = "EPISTLE_PANEL_PAGE_SIZE";
const REFRESH = "EPISTLE_PANEL_REFRESH";
const saved = { size: process.env[PAGE_SIZE], pace: process.env[REFRESH] };
const { readPreferences } = await import(".");

beforeEach(() => {
	cookies.reset();
	resetIntl();
	delete process.env[PAGE_SIZE];
	delete process.env[REFRESH];
});
afterEach(() => {
	for (const [key, value] of [
		[PAGE_SIZE, saved.size],
		[REFRESH, saved.pace],
	] as const) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

describe("readPreferences page size and refresh pace", () => {
	it("reads the person's cookies, each from its own", async () => {
		cookies.jar.set("page-size", "100");
		cookies.jar.set("refresh", "slow");

		expect(await readPreferences()).toMatchObject({
			pageSize: "100",
			refresh: "slow",
		});
	});

	it("shows what the operator fixed over the cookies", async () => {
		cookies.jar.set("page-size", "100");
		cookies.jar.set("refresh", "slow");
		process.env[PAGE_SIZE] = "25";
		process.env[REFRESH] = "fast";

		expect(await readPreferences()).toMatchObject({
			pageSize: "25",
			refresh: "fast",
		});
	});

	it("takes nothing of a tampered cookie, and no cookie can turn the refresh off", async () => {
		cookies.jar.set("page-size", "9999");
		cookies.jar.set("refresh", "off");

		expect(await readPreferences()).toMatchObject({
			pageSize: "50",
			refresh: "normal",
		});
	});
});
