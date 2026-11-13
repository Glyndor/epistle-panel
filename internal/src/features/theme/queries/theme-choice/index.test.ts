import { beforeEach, describe, expect, it } from "bun:test";

import { HOSTILE_THEME_VALUES } from "@/features/theme/test-support/hostile-choices";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { readThemeChoice } = await import(".");

beforeEach(() => cookies.reset());

describe("readThemeChoice", () => {
	it("is system without a theme cookie", async () => {
		expect(await readThemeChoice()).toBe("system");
	});

	it("is the cookie's choice when it holds one, exactly", async () => {
		for (const choice of ["system", "light", "dark"] as const) {
			cookies.jar.set("theme", choice);

			expect(await readThemeChoice()).toBe(choice);
		}
	});

	it("is system for a tampered cookie, whatever it holds", async () => {
		for (const value of HOSTILE_THEME_VALUES) {
			cookies.jar.set("theme", value);

			expect(await readThemeChoice()).toBe("system");
		}
	});

	it("reads only the theme cookie", async () => {
		cookies.jar.set("locale", "dark");
		cookies.jar.set("Theme", "dark");
		cookies.jar.set("theme2", "dark");

		expect(await readThemeChoice()).toBe("system");
	});
});
