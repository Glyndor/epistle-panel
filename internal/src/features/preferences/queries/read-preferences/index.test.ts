import { beforeEach, describe, expect, it } from "bun:test";

import { HOSTILE_DENSITY_VALUES } from "@/features/mail/test-support/hostile-densities";
import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";
import { intl, resetIntl } from "@/test/next-intl";

const cookies = mockRequestCookies();
const { readPreferences } = await import(".");

beforeEach(() => {
	cookies.reset();
	resetIntl();
});

describe("readPreferences", () => {
	it("is the language in force and the defaults of the other three when the person chose nothing", async () => {
		intl.locale = "pt";

		expect(await readPreferences()).toEqual({
			language: "pt",
			theme: "system",
			density: "comfortable",
			remoteImages: "ask",
		});
	});

	it("is what the cookies hold, each read from its own", async () => {
		intl.locale = "de";
		cookies.jar.set("theme", "dark");
		cookies.jar.set("list-density", "compact");
		cookies.jar.set("remote-images", "never");

		expect(await readPreferences()).toEqual({
			language: "de",
			theme: "dark",
			density: "compact",
			remoteImages: "never",
		});
	});

	it("takes nothing of a tampered cookie: each part falls back to its default", async () => {
		for (const theme of HOSTILE_THEME_VALUES) {
			for (const density of HOSTILE_DENSITY_VALUES.slice(0, 6)) {
				cookies.jar.set("theme", theme);
				cookies.jar.set("list-density", density);

				expect(await readPreferences()).toEqual({
					language: "en",
					theme: "system",
					density: "comfortable",
					remoteImages: "ask",
				});
			}
		}
	});

	it("falls back to English when the language the request resolved is none the panel ships", async () => {
		intl.locale = "xx";

		expect((await readPreferences()).language).toBe("en");
	});
});
