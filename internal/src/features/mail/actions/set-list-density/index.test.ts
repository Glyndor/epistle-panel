import { beforeEach, describe, expect, it } from "bun:test";

import { HOSTILE_DENSITY_VALUES } from "@/features/mail/test-support/hostile-densities";
import { mockRequestCookies } from "@/lib/auth/test-support/cookies";

const cookies = mockRequestCookies();
const { setListDensity } = await import(".");

beforeEach(() => {
	cookies.reset();
});

describe("setListDensity", () => {
	it("stores each density for a signed-in account, with the cookie's attributes", async () => {
		for (const role of ["admin", "user"] as const) {
			cookies.reset();
			await cookies.signIn("ana", role);

			for (const density of ["comfortable", "compact"]) {
				cookies.writes.length = 0;

				expect(await setListDensity(density)).toBe(true);

				expect(cookies.writes).toHaveLength(1);
				const [write] = cookies.writes;
				expect(write?.name).toBe("mail-density");
				expect(write?.value).toBe(density);
				// A year, only the mail area, and out of reach of a script.
				expect(write?.options).toEqual({
					httpOnly: true,
					secure: true,
					sameSite: "lax",
					path: "/app/mail",
					maxAge: 31_536_000,
				});
			}
		}
	});

	it("writes nothing without a session", async () => {
		expect(await setListDensity("compact")).toBe(false);
		expect(cookies.writes).toHaveLength(0);
	});

	it("writes nothing with a session cookie that is not a session", async () => {
		const token = await cookies.signIn();
		cookies.jar.set("__Host-epistle_session", `${token}x`);

		expect(await setListDensity("compact")).toBe(false);
		expect(cookies.writes).toHaveLength(0);
	});

	it("writes nothing for a value outside the densities", async () => {
		await cookies.signIn();

		for (const value of HOSTILE_DENSITY_VALUES) {
			expect(await setListDensity(value)).toBe(false);
		}
		for (const value of [undefined, null, 1, ["compact"], { a: 1 }]) {
			expect(await setListDensity(value as unknown as string)).toBe(
				false,
			);
		}
		expect(cookies.writes).toHaveLength(0);
	});
});
