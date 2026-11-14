import { beforeEach, describe, expect, it } from "bun:test";

import { HOSTILE_DENSITY_VALUES } from "@/features/mail/test-support/hostile-densities";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { readListDensity } = await import(".");

beforeEach(() => cookies.reset());

describe("readListDensity", () => {
	it("is comfortable without the cookie", async () => {
		expect(await readListDensity()).toBe("comfortable");
	});

	it("is the cookie's density when it holds one, exactly", async () => {
		for (const density of ["comfortable", "compact"] as const) {
			cookies.jar.set("mail-density", density);

			expect(await readListDensity()).toBe(density);
		}
	});

	it("is comfortable for a tampered cookie, whatever it holds", async () => {
		for (const value of HOSTILE_DENSITY_VALUES) {
			cookies.jar.set("mail-density", value);

			expect(await readListDensity()).toBe("comfortable");
		}
	});

	it("reads only its own cookie", async () => {
		cookies.jar.set("theme", "compact");
		cookies.jar.set("Mail-Density", "compact");
		cookies.jar.set("mail-density2", "compact");

		expect(await readListDensity()).toBe("comfortable");
	});
});
